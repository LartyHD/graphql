/*
 * Copyright (c) "Neo4j"
 * Neo4j Sweden AB [http://neo4j.com]
 *
 * This file is part of Neo4j.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { Driver } from "neo4j-driver";
import { GraphQLSchema } from "graphql";
import { addResolversToSchema, IExecutableSchemaDefinition, makeExecutableSchema } from "@graphql-tools/schema";
import { composeResolvers } from "@graphql-tools/resolvers-composition";
import { forEachField, IResolvers } from "@graphql-tools/utils";
import { mergeResolvers } from "@graphql-tools/merge";
import type { DriverConfig, CypherQueryOptions } from "../types";
import { makeAugmentedSchema } from "../schema";
import Node from "./Node";
import Relationship from "./Relationship";
import checkNeo4jCompat from "./utils/verify-database";
import assertIndexesAndConstraints, {
    AssertIndexesAndConstraintsOptions,
} from "./utils/asserts-indexes-and-constraints";
import { wrapResolver } from "../schema/resolvers/wrapper";
import { defaultFieldResolver } from "../schema/resolvers";
import { Secret } from "jsonwebtoken";
import { asArray } from "src/utils/utils";

export interface Neo4jGraphQLJWT {
    jwksEndpoint?: string;
    secret?: Secret;
    noVerify?: boolean;
    rolesPath?: string;
}

export interface Neo4jGraphQLConfig {
    driverConfig?: DriverConfig;
    jwt?: Neo4jGraphQLJWT;
    enableRegex?: boolean;
    skipValidateTypeDefs?: boolean;
    queryOptions?: CypherQueryOptions;
}

export interface Neo4jGraphQLConstructor extends IExecutableSchemaDefinition {
    config?: Neo4jGraphQLConfig;
    driver?: Driver;
}

class Neo4jGraphQL {
    private config: Neo4jGraphQLConfig;
    private driver?: Driver;

    private schemaDefinition: IExecutableSchemaDefinition;

    private _nodes?: Node[];
    private _relationships?: Relationship[];

    private schema?: Promise<GraphQLSchema>;

    constructor(input: Neo4jGraphQLConstructor) {
        const { config = {}, driver, ...schemaDefinition } = input;

        this.driver = driver;
        this.config = config;
        this.schemaDefinition = schemaDefinition;
    }

    public get nodes(): Node[] {
        if (!this._nodes) {
            throw new Error("You must await `.getSchema()` before accessing `nodes`");
        }

        return this._nodes;
    }

    public get relationships(): Relationship[] {
        if (!this._relationships) {
            throw new Error("You must await `.getSchema()` before accessing `relationships`");
        }

        return this._relationships;
    }

    async getSchema(): Promise<GraphQLSchema> {
        if (!this.schema) {
            this.schema = this.generateSchema();
        }

        return this.schema;
    }

    async checkNeo4jCompat(input: { driver?: Driver; driverConfig?: DriverConfig } = {}): Promise<void> {
        const driver = input.driver || this.driver;
        const driverConfig = input.driverConfig || this.config?.driverConfig;

        if (!driver) {
            throw new Error("neo4j-driver Driver missing");
        }

        return checkNeo4jCompat({ driver, driverConfig });
    }

    async assertIndexesAndConstraints(
        input: { driver?: Driver; driverConfig?: DriverConfig; options?: AssertIndexesAndConstraintsOptions } = {}
    ): Promise<void> {
        if (!this.schema) {
            throw new Error("You must call `.getSchema()` before `.assertIndexesAndConstraints()`");
        }

        await this.schema;

        const driver = input.driver || this.driver;
        const driverConfig = input.driverConfig || this.config?.driverConfig;

        if (!driver) {
            throw new Error("neo4j-driver Driver missing");
        }

        await assertIndexesAndConstraints({ driver, driverConfig, nodes: this.nodes, options: input.options });
    }

    private addDefaultFieldResolvers(schema: GraphQLSchema): GraphQLSchema {
        forEachField(schema, (field) => {
            if (!field.resolve) {
                // eslint-disable-next-line no-param-reassign
                field.resolve = defaultFieldResolver;
            }
        });

        return schema;
    }

    private wrapResolvers(resolvers: IResolvers, { schema }: { schema: GraphQLSchema }) {
        const wrapResolverArgs = {
            driver: this.driver,
            config: this.config,
            nodes: this.nodes,
            relationships: this.relationships,
            schema,
        };

        const resolversComposition = {
            "Query.*": [wrapResolver(wrapResolverArgs)],
            "Mutation.*": [wrapResolver(wrapResolverArgs)],
        };

        // Merge generated and custom resolvers
        const mergedResolvers = mergeResolvers(resolvers, ...asArray(this.schemaDefinition.resolvers));

        return composeResolvers(mergedResolvers, resolversComposition);
    }

    private addWrappedResolversToSchema(resolverlessSchema: GraphQLSchema, resolvers: IResolvers): GraphQLSchema {
        const schema = addResolversToSchema(resolverlessSchema, resolvers);

        return this.addDefaultFieldResolvers(schema);
    }

    private generateSchema(): Promise<GraphQLSchema> {
        return new Promise((resolve) => {
            const { nodes, relationships, typeDefs, resolvers } = makeAugmentedSchema(this.schemaDefinition.typeDefs, {
                enableRegex: this.config?.enableRegex,
                skipValidateTypeDefs: this.config?.skipValidateTypeDefs,
            });

            this._nodes = nodes;
            this._relationships = relationships;

            const resolverlessSchema = makeExecutableSchema({
                ...this.schemaDefinition,
                typeDefs,
            });

            // Wrap the generated resolvers, which adds a context including the schema to every request
            const wrappedResolvers = this.wrapResolvers(resolvers, { schema: resolverlessSchema });

            const schema = this.addWrappedResolversToSchema(resolverlessSchema, wrappedResolvers);

            resolve(schema);
        });
    }
}

export default Neo4jGraphQL;
