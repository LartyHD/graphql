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

import { on } from "events";
import { GraphQLResolveInfo } from "graphql";
import Node from "../../../classes/Node";
import { SubscriptionsEvent } from "../../../subscriptions/subscriptions-event";
import { Neo4jGraphQLSubscriptionsPlugin } from "../../../types";

export type SubscriptionContext = {
    plugin: Neo4jGraphQLSubscriptionsPlugin;
};

export function subscriptionResolve(payload, args, context, info) {
    return JSON.stringify(payload);
}

export function createSubscription(node: Node) {
    return (
        _root: any,
        args: any,
        context: SubscriptionContext,
        info: GraphQLResolveInfo
    ): AsyncIterator<SubscriptionsEvent> => {
        // const iterator = context.plugin.pubsub.asyncIterator(["create"]);
        // const iterable: AsyncIterable<SubscriptionsEvent> = iterator[Symbol.asyncIterator]();
        const iterable = on(context.plugin.events, "create");
        return filterIterable<SubscriptionsEvent>(iterable, (data) => {
            console.log(data);
            return data.typename === node.name;
        });
    };
}
async function* filterIterable<T>(
    source: AsyncIterable<T>,
    predicate: (t: T) => boolean | Promise<boolean>
): AsyncIterator<T> {
    for await (const item of source) {
        if (await predicate(item)) {
            yield item;
        }
    }
}
