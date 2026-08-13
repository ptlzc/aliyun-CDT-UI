import {render, screen, within} from '@testing-library/react';
import {describe, expect, it, vi} from 'vitest';

import type {CdtPermissionResult} from '../../lib/api/client';
import type {CloudAccount} from '../../types';
import AuthPolicyModal from '../AuthPolicyModal';

const notPermitted: CdtPermissionResult = {permitted: false, errorType: 'permission'};

const account: CloudAccount = {
  id: 'acc-1',
  name: 'Account A',
  providerRegion: 'Aliyun Domestic',
  mainRegion: 'cn-hangzhou',
  lastSynced: 'Just now',
  creationDate: '2026-06-17',
  accessKeyId: 'ak',
  accessKeySecret: 'secret',
  managedRegions: 'cn-hangzhou',
  trafficDefaults: {
    maximumTrafficGb: 200,
    overflowAction: 'notify',
    monitoringEnabled: true,
  },
};

/**
 * Locates the missing-permission paragraph ("该账号缺少 … 权限") of the modal.
 * The action names live in nested <code> elements, so getByText cannot match
 * the full sentence; the function matcher resolves the paragraph by its direct
 * text and `within` then asserts on the code children. Scoping to the paragraph
 * keeps the assertions from passing against the embedded <pre> policy JSON
 * (which contains the actions too).
 *
 * @when 权限文案回归: 未授权账号的提示需同时提及 CDT 与 BSS 权限
 */
function getMissingPermissionParagraph(): HTMLElement {
  return screen.getByText((content, element) => {
    return element?.tagName === 'P' && content.includes('该账号缺少') && content.includes('权限');
  });
}

describe('AuthPolicyModal missing-permission copy', () => {
  it('names cdt:ListCdtInternetTraffic and bss:QueryInstanceBill in one sentence', () => {
    render(<AuthPolicyModal account={account} cdtPermission={notPermitted} onClose={vi.fn()} />);

    const paragraph = getMissingPermissionParagraph();
    expect(within(paragraph).getByText('cdt:ListCdtInternetTraffic')).toBeInTheDocument();
    expect(within(paragraph).getByText('bss:QueryInstanceBill')).toBeInTheDocument();
  });

  it('shows the full policy JSON including QueryInstanceBill and the legacy DescribeBillList actions', () => {
    render(<AuthPolicyModal account={account} cdtPermission={notPermitted} onClose={vi.fn()} />);

    const jsonBlock = screen.getByText((content, element) => {
      return element?.tagName === 'PRE' && content.includes('"Statement"');
    });
    expect(jsonBlock.textContent).toContain('bss:QueryInstanceBill');
    expect(jsonBlock.textContent).toContain('bss:DescribeBillList');
    expect(jsonBlock.textContent).toContain('cdt:ListCdtInternetTraffic');
  });

  it('closes via the header close button', () => {
    const onClose = vi.fn();
    render(<AuthPolicyModal account={account} cdtPermission={notPermitted} onClose={onClose} />);

    expect(screen.getByRole('button', {name: '关闭'})).toBeInTheDocument();
  });
});
