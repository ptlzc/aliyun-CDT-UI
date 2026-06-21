import {render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {describe, expect, it, vi} from 'vitest';

import SettingsView from './SettingsView';

const saveMutate = vi.fn();
const applyMutate = vi.fn();

vi.mock('../features/runtime/hooks', () => ({
  useSavePlatformDefaultsMutation: () => ({
    mutate: saveMutate,
    isPending: false,
  }),
  useApplyPlatformDefaultsMutation: () => ({
    mutate: applyMutate,
    isPending: false,
    data: null,
  }),
}));

describe('SettingsView', () => {
  it('submits platform defaults and rollout action', async () => {
    const user = userEvent.setup();

    render(
      <SettingsView
        defaults={{
          maximumTrafficGb: 200,
          overflowAction: 'notify',
          monitoringEnabled: true,
        }}
      />,
    );

    await user.clear(screen.getByDisplayValue('200'));
    await user.type(screen.getByRole('spinbutton'), '300');
    await user.selectOptions(screen.getByRole('combobox'), 'keepalive-job');
    await user.click(screen.getByText('保存默认值'));
    await user.click(screen.getByText('应用到现有账号'));

    expect(saveMutate).toHaveBeenCalledWith({
      maximumTrafficGb: 300,
      overflowAction: 'keepalive-job',
      monitoringEnabled: true,
    });
    expect(applyMutate).toHaveBeenCalled();
  });
});
