import {describe, it, expect, jest } from '@jest/globals';
import { World } from './world'
import { EntitySystem } from './system';

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

        world.addSystem(new EntitySystem((q) => q.hasEveryComponent(b), updateFn))

        world.addSystem(new EntitySystem((q) => q.hasSomeComponents(c), updateFn2))

        world.update()

        expect(updateFn).toBeCalled();
        expect(updateFn2).not.toBeCalled();
    });
}) 