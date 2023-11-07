import {describe, it, expect, test, jest } from '@jest/globals';
import { World } from './world'
import { EntitySystem } from './system';
import { query } from './query';

describe("test", () => {
    it('works', () => {
        const world = new World();
        const a = world.createComponent();
        const b = world.createComponent();
        const c = world.createComponent();

        const e1 = world.createEntity();
        const e2 = world.createEntity();
        const e3 = world.createEntity();

        world.addComponent(e1, b);
        world.addComponent(e3, b);
        world.addComponent(e2, b);
        world.addComponent(e3, a);

        const updateFn = jest.fn();
        const updateFn2 = jest.fn();

        world.addSystem(new EntitySystem(query((q) => q.some(b)), updateFn))

        world.addSystem(new EntitySystem(query((q) => q.some(c)), updateFn2))

        world.update()

        expect(updateFn).toBeCalled();
        expect(updateFn2).not.toBeCalled();
    });
}) 