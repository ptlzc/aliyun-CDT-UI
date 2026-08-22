import {render, screen, within} from '@testing-library/react';
import {describe, expect, it, vi} from 'vitest';

import type {CdtPermissionResult} from '../../lib/api/client';
import AuthPolicyModal from '../AuthPolicyModal';

const notPermitted: CdtPermissionResult = {permitted: false, errorType: 'permission'};

/**
 * Locates the structured CDT permission summary rather than matching the JSON
 * block, which intentionally contains every platform action.
 *
 * @when 权限文案回归: CDT 检测只声明其实际检测到的权限缺口
 */
function getMissingPermissionParagraph(): HTMLElement {
  return screen.getByText((content, element) => {
    return element?.tagName === 'P' && content.includes('当前检测至少缺少');
  });
}

describe('AuthPolicyModal missing-permission copy', () => {
  it('reports the concrete CDT gap without claiming that BSS was probed', () => {
    render(<AuthPolicyModal accountName="Account A" siteType="domestic" cdtPermission={notPermitted} onClose={vi.fn()} />);

    const paragraph = getMissingPermissionParagraph();
    expect(within(paragraph).getByText('cdt:ListCdtInternetTraffic')).toBeInTheDocument();
    expect(paragraph.textContent).not.toContain('bssapi:QueryInstanceBill');
  });

  it('shows the full policy JSON including the exact BSS OpenAPI action', () => {
    render(<AuthPolicyModal accountName="Account A" siteType="domestic" cdtPermission={notPermitted} onClose={vi.fn()} />);

    const jsonBlock = screen.getByTestId('account-policy-json');
    expect(jsonBlock.textContent).toContain('bssapi:QueryInstanceBill');
    expect(jsonBlock.textContent).not.toContain('bss:QueryInstanceBill');
    expect(jsonBlock.textContent).toContain('cdt:ListCdtInternetTraffic');
  });

  it('supports an unsaved international account draft', () => {
    render(<AuthPolicyModal accountName="" siteType="international" onClose={vi.fn()} />);

    expect(screen.getByRole('dialog', {name: /账号 RAM 授权策略 — 新账号/})).toBeInTheDocument();
    expect(screen.getByRole('link', {name: /前往阿里云国际 RAM 控制台/})).toHaveAttribute(
      'href',
      'https://ram.console.alibabacloud.com/users',
    );
  });

  it('closes via the header close button', () => {
    const onClose = vi.fn();
    render(<AuthPolicyModal accountName="Account A" siteType="domestic" cdtPermission={notPermitted} onClose={onClose} />);

    expect(screen.getByRole('button', {name: '关闭'})).toBeInTheDocument();
  });
});
