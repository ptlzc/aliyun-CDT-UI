import {render, screen, within} from '@testing-library/react';
import {describe, expect, it, vi} from 'vitest';

import type {CdtPermissionResult} from '../../../lib/api/client';
import PermissionStatusCard from '../components/PermissionStatusCard';

const notPermitted: CdtPermissionResult = {permitted: false, errorType: 'permission'};

/**
 * Locates the missing-permission paragraph ("该账号缺少 … 权限") of the
 * permission status card. The action names live in nested <code> elements, so
 * getByText cannot match the full sentence; the function matcher resolves the
 * paragraph by its direct text and `within` then asserts on the code children.
 *
 * @when 权限文案回归: 未授权账号的提示需同时提及 CDT 与 BSS 权限
 */
function getMissingPermissionParagraph(): HTMLElement {
  return screen.getByText((content, element) => {
    return element?.tagName === 'P' && content.includes('该账号缺少') && content.includes('权限');
  });
}

describe('missing-permission copy mentions CDT and BSS actions', () => {
  it('PermissionStatusCard names cdt:ListCdtInternetTraffic and bss:QueryInstanceBill in one sentence', () => {
    render(<PermissionStatusCard cdtPermission={notPermitted} isLoading={false} onOpenAuthModal={vi.fn()} />);

    const paragraph = getMissingPermissionParagraph();
    expect(within(paragraph).getByText('cdt:ListCdtInternetTraffic')).toBeInTheDocument();
    expect(within(paragraph).getByText('bss:QueryInstanceBill')).toBeInTheDocument();
  });
});
