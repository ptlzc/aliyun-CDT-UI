import {render, screen, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
    return element?.tagName === 'P' && content.includes('当前检测至少缺少') && content.includes('权限');
  });
}

describe('missing-permission copy opens the full policy guide', () => {
  it('names the detected CDT action and opens the policy modal from the prompt', async () => {
    const onOpenAuthModal = vi.fn();
    const user = userEvent.setup();
    render(<PermissionStatusCard cdtPermission={notPermitted} isLoading={false} onOpenAuthModal={onOpenAuthModal} />);

    const paragraph = getMissingPermissionParagraph();
    expect(within(paragraph).getByText('cdt:ListCdtInternetTraffic')).toBeInTheDocument();
    expect(paragraph.textContent).not.toContain('bss:QueryInstanceBill');

    await user.click(screen.getByRole('button', {name: '查看所需权限 JSON'}));
    expect(onOpenAuthModal).toHaveBeenCalledTimes(1);
  });
});
