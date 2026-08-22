import {render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {beforeEach, describe, expect, it, vi} from 'vitest';

import AccountPolicyCard from '../AccountPolicyCard';
import {accountPolicyJsonText} from '../accountPolicy';

describe('AccountPolicyCard', () => {
  let writeTextMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: {writeText: writeTextMock},
      configurable: true,
    });
  });

  function setupUser() {
    const user = userEvent.setup();
    Object.defineProperty(navigator, 'clipboard', {
      value: {writeText: writeTextMock},
      configurable: true,
    });
    return user;
  }

  it('shows the full policy and actionable RAM authorization steps', () => {
    render(<AccountPolicyCard siteType="domestic" />);

    const jsonBlock = screen.getByTestId('account-policy-json');
    expect(jsonBlock.textContent).toBe(accountPolicyJsonText);
    expect(screen.getByText(/创建专用于本平台的 RAM 用户/)).toBeInTheDocument();
    expect(screen.getByText(/切换到脚本编辑/)).toBeInTheDocument();
    expect(screen.getByText(/绑定到该 RAM 用户/)).toBeInTheDocument();
  });

  it('copies the complete JSON and reports success', async () => {
    const user = setupUser();
    render(<AccountPolicyCard siteType="domestic" />);

    await user.click(screen.getByRole('button', {name: '复制权限 JSON'}));

    expect(writeTextMock).toHaveBeenCalledWith(accountPolicyJsonText);
    expect(await screen.findByText('已复制')).toBeInTheDocument();
  });

  it('reports clipboard failure without claiming success', async () => {
    writeTextMock.mockRejectedValue(new Error('clipboard denied'));
    const user = setupUser();
    render(<AccountPolicyCard siteType="domestic" />);

    await user.click(screen.getByRole('button', {name: '复制权限 JSON'}));

    expect(await screen.findByText('复制失败，请手动选择 JSON')).toBeInTheDocument();
    expect(screen.queryByText('已复制')).not.toBeInTheDocument();
  });

  it('uses the RAM console matching the selected site', () => {
    const {rerender} = render(<AccountPolicyCard siteType="domestic" />);
    expect(screen.getByRole('link', {name: /前往阿里云 RAM 控制台/})).toHaveAttribute(
      'href',
      'https://ram.console.aliyun.com/users',
    );

    rerender(<AccountPolicyCard siteType="international" />);
    expect(screen.getByRole('link', {name: /前往阿里云国际 RAM 控制台/})).toHaveAttribute(
      'href',
      'https://ram.console.alibabacloud.com/users',
    );
  });
});
