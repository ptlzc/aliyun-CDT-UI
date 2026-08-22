import {createMemoryRouter, RouterProvider} from 'react-router-dom';
import {render, screen, waitFor, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {beforeEach, describe, expect, it, vi} from 'vitest';

import DeploymentPage from '../index';
import type {ApiAccount} from '../../../lib/api/client';

const h = vi.hoisted(() => ({
  mutateImpl: vi.fn(),
  continueImpl: vi.fn(),
}));

const accounts: ApiAccount[] = [
  {
    id: 'acc-1',
    name: 'Account A',
    accessKeyId: 'ak',
    accessKeySecret: 'sk',
    createdAt: '2026-06-17T00:00:00Z',
    updatedAt: '2026-06-17T00:00:00Z',
    defaultImageKey: '',
    ossBucket: 'bucket',
    ossEndpoint: 'oss-cn-hangzhou.aliyuncs.com',
    regionId: 'cn-hangzhou',
    regions: ['cn-hangzhou', 'us-west-1'],
    siteType: 'international',
    zoneId: 'cn-hangzhou-g',
  },
];

const regions = [
  {regionId: 'us-west-1', localName: '美国 (硅谷)'},
  {regionId: 'cn-hangzhou', localName: '华东 1 (杭州)'},
];

const inventoryGraph = {
  accountId: 'acc-1',
  nodes: [] as Array<{
    id: string;
    kind: string;
    name: string;
    status: string;
    regionId?: string;
    zoneId?: string;
    metadata?: {[key: string]: string};
  }>,
  edges: [],
  summary: {ecsCount: 0, eipCount: 0, imageCount: 0, vpcCount: 0, vswitchCount: 0, securityGroupCount: 0},
};

vi.mock('../../../features/runtime/hooks', () => ({
  useAccountsQuery: () => ({data: accounts, isLoading: false}),
  useRegionsQuery: () => ({data: regions, isLoading: false}),
  useInventoryGraphQuery: () => ({data: inventoryGraph, isLoading: false}),
  useJobsQuery: () => ({data: [], isLoading: false}),
  useCreateOneClickDeploymentMutation: () => ({mutate: h.mutateImpl, isPending: false, error: null}),
  useContinueOneClickDeploymentMutation: () => ({mutate: h.continueImpl, isPending: false, error: null}),
}));

function renderPage() {
  const router = createMemoryRouter([{path: '/', element: <DeploymentPage />}], {initialEntries: ['/']});
  render(<RouterProvider router={router} />);
  return router;
}

describe('DeploymentPage from ECS template', () => {
  beforeEach(() => {
    h.mutateImpl.mockReset();
    h.continueImpl.mockReset();
    inventoryGraph.nodes = [];
    inventoryGraph.edges = [];
  });

  it('populates source ECS, zone, and instance type dropdowns from the inventory graph', async () => {
    const user = userEvent.setup();
    inventoryGraph.nodes = [
      {id: 'i-template', kind: 'ecs', name: 'Template ECS', status: 'Running', regionId: 'us-west-1', zoneId: 'us-west-1a', metadata: {instanceType: 'ecs.g7.large'}},
      {id: 'i-other', kind: 'ecs', name: 'Other ECS', status: 'Running', regionId: 'cn-hangzhou', zoneId: 'cn-hangzhou-g', metadata: {instanceType: 'ecs.c6.large'}},
    ];
    renderPage();

    await user.selectOptions(screen.getByRole('combobox', {name: /托管账号/}), 'acc-1');
    await user.selectOptions(screen.getByRole('combobox', {name: /地域/}), 'us-west-1');

    const sourceSelect = screen.getByRole('combobox', {name: /系统模板来源/});
    expect(within(sourceSelect).getByRole('option', {name: /Template ECS/})).toBeInTheDocument();
    expect(within(sourceSelect).queryByRole('option', {name: /Other ECS/})).not.toBeInTheDocument();

    const zoneSelect = screen.getByRole('combobox', {name: /可用区/});
    expect(within(zoneSelect).getByRole('option', {name: 'us-west-1a'})).toBeInTheDocument();
    expect(within(zoneSelect).queryByRole('option', {name: 'cn-hangzhou-g'})).not.toBeInTheDocument();

    const typeSelect = screen.getByRole('combobox', {name: /实例规格/});
    expect(within(typeSelect).getByRole('option', {name: 'ecs.g7.large'})).toBeInTheDocument();
    expect(within(typeSelect).queryByRole('option', {name: 'ecs.c6.large'})).not.toBeInTheDocument();
  });

  it('submits sourceInstanceId when creating from an existing ECS template and omits S3 fields', async () => {
    const user = userEvent.setup();
    inventoryGraph.nodes = [
      {id: 'i-template', kind: 'ecs', name: 'Template ECS', status: 'Running', regionId: 'us-west-1', zoneId: 'us-west-1a', metadata: {instanceType: 'ecs.g7.large'}},
    ];
    renderPage();

    await user.selectOptions(screen.getByRole('combobox', {name: /托管账号/}), 'acc-1');
    await user.selectOptions(screen.getByRole('combobox', {name: /地域/}), 'us-west-1');
    await user.selectOptions(screen.getByRole('combobox', {name: /存储类型/}), 's3');
    expect(screen.getByRole('textbox', {name: /S3 Bucket/})).toBeInTheDocument();

    await user.selectOptions(screen.getByRole('combobox', {name: /系统模板来源/}), 'i-template');
    expect(screen.queryByRole('textbox', {name: /S3 Bucket/})).not.toBeInTheDocument();
    await user.selectOptions(screen.getByRole('combobox', {name: /可用区/}), 'us-west-1a');
    await user.selectOptions(screen.getByRole('combobox', {name: /实例规格/}), 'ecs.g7.large');
    await user.click(screen.getByRole('button', {name: /开始一键部署/}));

    await waitFor(() => {
      expect(h.mutateImpl).toHaveBeenCalledTimes(1);
    });
    expect(h.mutateImpl).toHaveBeenCalledWith(
      {
        accountId: 'acc-1',
        body: {
          regionId: 'us-west-1',
          zoneId: 'us-west-1a',
          instanceType: 'ecs.g7.large',
          imageType: 'system',
          storageProvider: 's3',
          sourceInstanceId: 'i-template',
          attachGovernance: true,
        },
      },
      expect.anything(),
    );
  });
});
