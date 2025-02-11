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

import {
    DirectiveLocation,
    GraphQLDirective,
    GraphQLInputObjectType,
    GraphQLList,
    GraphQLNonNull,
    GraphQLString,
} from "graphql";

export const fulltextDirective = new GraphQLDirective({
    name: "fulltext",
    description:
        "Informs @neo4j/graphql that there should be a fulltext index in the database, allows users to search by the index in the generated schema.",
    args: {
        indexes: {
            type: new GraphQLNonNull(
                new GraphQLList(
                    new GraphQLInputObjectType({
                        name: "FullTextInput",
                        fields: {
                            name: {
                                type: new GraphQLNonNull(GraphQLString),
                            },
                            fields: {
                                type: new GraphQLNonNull(new GraphQLList(GraphQLString)),
                            },
                        },
                    })
                )
            ),
        },
    },
    locations: [DirectiveLocation.OBJECT],
});
