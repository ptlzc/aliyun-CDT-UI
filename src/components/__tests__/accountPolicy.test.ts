import {describe, expect, it} from 'vitest';

import {accountPolicyJson, accountPolicyJsonText, isPermissionErrorMessage} from '../accountPolicy';

const expectedActions = [
  'ecs:DescribeRegions',
  'ecs:DescribeInstances',
  'ecs:DescribeImages',
  'ecs:DescribeTasks',
  'ecs:DescribeSecurityGroups',
  'ecs:DescribeSecurityGroupAttribute',
  'ecs:CreateSecurityGroup',
  'ecs:AuthorizeSecurityGroup',
  'ecs:RevokeSecurityGroup',
  'ecs:AuthorizeSecurityGroupEgress',
  'ecs:RevokeSecurityGroupEgress',
  'ecs:RunInstances',
  'ecs:StartInstance',
  'ecs:StopInstance',
  'ecs:DeleteInstance',
  'ecs:DescribeInstanceVncUrl',
  'ecs:ImportImage',
  'vpc:DescribeVpcs',
  'vpc:CreateVpc',
  'vpc:DescribeVSwitches',
  'vpc:CreateVSwitch',
  'vpc:DescribeEipAddresses',
  'vpc:AllocateEipAddress',
  'vpc:AssociateEipAddress',
  'vpc:UnassociateEipAddress',
  'vpc:DescribeEipMonitorData',
  'cms:QueryMetricLast',
  'cdt:ListCdtInternetTraffic',
  'bssapi:QueryInstanceBill',
  'oss:ListBuckets',
  'oss:PutBucket',
  'oss:PutObject',
  'oss:GetObject',
];

describe('account RAM policy contract', () => {
  it('contains exactly the actions exercised by the current platform workflows', () => {
    expect(accountPolicyJson.Statement).toHaveLength(1);
    expect(accountPolicyJson.Statement[0].Action).toEqual(expectedActions);
    expect(accountPolicyJson.Statement[0].Resource).toBe('*');
  });

  it('serializes to paste-ready JSON without invalid or unused actions', () => {
    expect(JSON.parse(accountPolicyJsonText)).toEqual(accountPolicyJson);
    expect(accountPolicyJsonText).toContain('"bssapi:QueryInstanceBill"');
    expect(accountPolicyJsonText).not.toContain('"bss:QueryInstanceBill"');
    expect(accountPolicyJsonText).not.toContain('"oss:DeleteObject"');
  });

  it('classifies only explicit permission-shaped errors for the fallback UI', () => {
    expect(isPermissionErrorMessage('NoPermission: ecs:DescribeRegions')).toBe(true);
    expect(isPermissionErrorMessage('AccessDenied')).toBe(true);
    expect(isPermissionErrorMessage('403 Forbidden')).toBe(true);
    expect(isPermissionErrorMessage('凭据有效，但权限不足')).toBe(true);
    expect(isPermissionErrorMessage('InvalidAccessKeyId')).toBe(false);
    expect(isPermissionErrorMessage('TLS handshake timeout')).toBe(false);
  });
});
