import { Framework } from '@toeverything/infra';
import { describe, expect, test } from 'vitest';

import { ViewScope } from '../../scopes/view';
import { SidebarTab } from '../sidebar-tab';
import { View } from '../view';

const createView = () => {
  const framework = new Framework();
  framework.entity(View);
  framework.scope(ViewScope).entity(SidebarTab);
  return framework.provider().createEntity(View, { id: 'test-view' });
};

describe('View sidebar tabs', () => {
  test('returns null when no tab is registered', () => {
    const view = createView();
    expect(view.activeSidebarTab$.value).toBeNull();
  });

  test('falls back to the first registered tab by default', () => {
    const view = createView();
    view.addSidebarTab('chat');
    view.addSidebarTab('outline');
    expect(view.activeSidebarTab$.value?.id).toBe('chat');
  });

  test('prefers the tab registered as default over the first tab', () => {
    const view = createView();
    view.addSidebarTab('chat');
    view.addSidebarTab('outline', true);
    expect(view.activeSidebarTab$.value?.id).toBe('outline');
  });

  test('explicitly activated tab wins over the default tab', () => {
    const view = createView();
    view.addSidebarTab('chat');
    view.addSidebarTab('outline', true);
    view.addSidebarTab('properties');
    view.activeSidebarTab('properties');
    expect(view.activeSidebarTab$.value?.id).toBe('properties');
  });

  test('falls back to the first tab when the default tab is removed', () => {
    const view = createView();
    view.addSidebarTab('chat');
    view.addSidebarTab('outline', true);
    view.removeSidebarTab('outline');
    expect(view.activeSidebarTab$.value?.id).toBe('chat');
  });

  test('keeps the default tab after a non-default one is removed', () => {
    const view = createView();
    view.addSidebarTab('chat');
    view.addSidebarTab('outline', true);
    view.removeSidebarTab('chat');
    expect(view.activeSidebarTab$.value?.id).toBe('outline');
  });
});
