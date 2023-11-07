// originally from https://raw.githubusercontent.com/sondresj/piecs/a3688c46afba6af20ce97c7d89ba201ac4294558/packages/piecs/src/Query.ts
// MIT License

// Copyright (c) 2021 Sondre S. Jensen

// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:

// The above copyright notice and this permission notice shall be included in all
// copies or substantial portions of the Software.

// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.

import { Archetype } from "./archetype";
import { Component } from "./types"

export type QueryMatcher = (target: Archetype) => boolean

export type Query = {
    matches: QueryMatcher;
}

function makeAndMatcher(matcher: QueryMatcher, ...matchers: QueryMatcher[]): QueryMatcher {
    return (target) => matcher(target) && matchers.every(m => m(target))
}

function makeOrMatcher(matcher: QueryMatcher, ...matchers: QueryMatcher[]): QueryMatcher {
    return (target) => matcher(target) || matchers.some(m => m(target))
}

const alwaysTrue: QueryMatcher = () => true

export type QueryBuilder = {
    every(...cids: Component[]): QueryBuilder
    some(...cids: Component[]): QueryBuilder
    not(...cids: Component[]): QueryBuilder
    none(...cids: Component[]): QueryBuilder
    or(callback: (builder: QueryBuilder) => QueryBuilder): QueryBuilder
    custom(matcher: QueryMatcher): QueryBuilder
    toQuery(): Query
    readonly matchers: ReadonlyArray<QueryMatcher>
}

function createBuilder(): QueryBuilder {
    let _matchers: QueryMatcher[] = []
    return {
        get matchers() {
            return _matchers
        },
        or(cb) {
            const [first = alwaysTrue, ...rest] = _matchers
            _matchers = [
                makeOrMatcher(
                    makeAndMatcher(first, ...rest),
                    ...cb(createBuilder()).matchers
                )
            ]
            return this
        },
        every(...components) {
            if (components.length === 0) {
                return this
            }
            _matchers.push((target) => target.hasEveryComponent(components))
            return this
        },
        some(...components) {
            if (components.length === 0) {
                return this
            }
            _matchers.push((target) => target.hasSomeComponents(components))
            return this
        },
        not(...components) {
            if (components.length === 0) {
                return this
            }
            _matchers.push((target) => target.hasNotComponents(components))
            return this
        },
        none(...components) {
            if (components.length === 0) {
                return this
            }
            _matchers.push((target) => target.hasNoneComponents(components))
            return this
        },
        custom(matcher) {
            _matchers.push(matcher)
            return this
        },
        toQuery() {
            const [first = alwaysTrue, ...rest] = _matchers
            const matcher = rest.length
                ? makeAndMatcher(first, ...rest)
                : first
            
            return {
                matches: matcher
            }
        },
    }
}

export function query(callback: (builder: QueryBuilder) => QueryBuilder): Query {
    return callback(createBuilder()).toQuery()
}