import {AlertTriangle, LoaderCircle, ShieldCheck, Trash2, X} from 'lucide-react';
import {useEffect, useMemo, useState, type FormEvent} from 'react';

import {isPermissionErrorMessage} from '@/components/accountPolicy';
import {useInstanceFirewall} from '@/features/runtime/instanceFirewallHooks';
import type {ApiInstanceFirewallRuleRequest, ApiSecurityGroupRule} from '@/lib/api/client';
import type {ECSInstance} from '@/types';

interface InstanceFirewallModalProps {
  instance: ECSInstance;
  onClose: () => void;
  onViewPolicy?: () => void;
}

const inputClass = 'w-full rounded border border-hairline-divider bg-surface-white px-2.5 py-2 text-xs text-primary-ink focus:border-primary focus:outline-none';

function errorText(error: unknown): string | null {
  if (!error) return null;
  return error instanceof Error ? error.message : String(error);
}

function RuleTable({
  rules,
  deleting,
  pendingRuleId,
  onRequestDelete,
  onConfirmDelete,
}: {
  rules: ApiSecurityGroupRule[];
  deleting: boolean;
  pendingRuleId: string | null;
  onRequestDelete: (ruleId: string) => void;
  onConfirmDelete: (rule: ApiSecurityGroupRule) => void;
}) {
  if (rules.length === 0) {
    return <p className="rounded border border-dashed border-hairline-divider p-5 text-center text-xs text-secondary-ink">当前方向暂无规则。</p>;
  }
  return (
    <div className="overflow-x-auto rounded border border-hairline-divider">
      <table className="w-full min-w-[620px] text-left text-[11px]">
        <thead className="bg-section-layer text-secondary-ink">
          <tr><th className="px-3 py-2">协议 / 端口</th><th className="px-3 py-2">CIDR</th><th className="px-3 py-2">策略</th><th className="px-3 py-2">优先级</th><th className="px-3 py-2">描述</th><th className="px-3 py-2 text-right">操作</th></tr>
        </thead>
        <tbody className="divide-y divide-hairline-divider">
          {rules.map((rule, index) => {
            const key = rule.ruleId || `${rule.protocol}-${rule.portRange}-${rule.cidr}-${index}`;
            return (
              <tr key={key}>
                <td className="px-3 py-2 font-mono uppercase">{rule.protocol} {rule.portRange}</td>
                <td className="px-3 py-2 font-mono">{rule.cidr}</td>
                <td className="px-3 py-2">{rule.policy === 'accept' ? '允许' : '拒绝'}</td>
                <td className="px-3 py-2">{rule.priority}</td>
                <td className="max-w-44 truncate px-3 py-2 text-secondary-ink">{rule.description || '-'}</td>
                <td className="px-3 py-2 text-right">
                  {!rule.ruleId ? (
                    <span title="阿里云未返回规则 ID，无法在此删除" className="text-secondary-ink">只读</span>
                  ) : pendingRuleId === rule.ruleId ? (
                    <button type="button" aria-label={`确认删除 ${rule.ruleId}`} disabled={deleting} onClick={() => onConfirmDelete(rule)} className="rounded bg-recovery-red px-2 py-1 font-semibold text-white disabled:opacity-50">确认删除</button>
                  ) : (
                    <button type="button" aria-label={`删除规则 ${rule.ruleId}`} onClick={() => onRequestDelete(rule.ruleId!)} className="rounded p-1 text-secondary-ink hover:bg-recovery-red/10 hover:text-recovery-red"><Trash2 className="h-3.5 w-3.5" /></button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function InstanceFirewallModal({instance, onClose, onViewPolicy}: InstanceFirewallModalProps) {
  const {snapshotQuery, createMutation, deleteMutation, tailscaleMutation} = useInstanceFirewall(instance.accountId, instance.id);
  const groups = snapshotQuery.data?.securityGroups ?? [];
  const [securityGroupId, setSecurityGroupId] = useState('');
  const [direction, setDirection] = useState<'ingress' | 'egress'>('ingress');
  const [protocol, setProtocol] = useState('tcp');
  const [startPort, setStartPort] = useState('22');
  const [endPort, setEndPort] = useState('22');
  const [cidr, setCidr] = useState('0.0.0.0/0');
  const [policy, setPolicy] = useState('accept');
  const [priority, setPriority] = useState('1');
  const [description, setDescription] = useState('');
  const [pendingRuleId, setPendingRuleId] = useState<string | null>(null);
  const [tailscaleConfirmed, setTailscaleConfirmed] = useState(false);

  useEffect(() => {
    if (!securityGroupId && groups.length > 0) setSecurityGroupId(groups[0].id);
  }, [groups, securityGroupId]);

  const selectedGroup = groups.find((group) => group.id === securityGroupId) ?? groups[0];
  const rules = useMemo(() => {
    if (!selectedGroup) return [];
    return (direction === 'ingress' ? selectedGroup.ingressRules : selectedGroup.egressRules) ?? [];
  }, [direction, selectedGroup]);
  const providerError = errorText(snapshotQuery.error) || errorText(createMutation.error) || errorText(deleteMutation.error) || errorText(tailscaleMutation.error);
  const tailscaleFailures = (tailscaleMutation.data?.operations ?? []).filter((operation) => operation.status === 'failed');
  const isPortProtocol = protocol === 'tcp' || protocol === 'udp';
  const start = Number(startPort);
  const end = Number(endPort);
  const portValid = !isPortProtocol || (Number.isInteger(start) && Number.isInteger(end) && start >= 1 && end <= 65535 && start <= end);
  const formValid = Boolean(selectedGroup && cidr.trim() && portValid && Number(priority) >= 1 && Number(priority) <= 100);

  const submitRule = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedGroup || !formValid) return;
    const rule: ApiInstanceFirewallRuleRequest = {
      direction,
      protocol,
      portRange: isPortProtocol ? `${start}/${end}` : '-1/-1',
      cidr: cidr.trim(),
      policy,
      priority: Number(priority),
      description: description.trim() || undefined,
    };
    createMutation.mutate({securityGroupId: selectedGroup.id, rule});
  };

  const confirmDelete = (rule: ApiSecurityGroupRule) => {
    if (!selectedGroup || !rule.ruleId) return;
    deleteMutation.mutate({securityGroupId: selectedGroup.id, ruleId: rule.ruleId, direction});
    setPendingRuleId(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-primary-ink/45 p-4 backdrop-blur-xs" onClick={onClose}>
      <section role="dialog" aria-modal="true" aria-labelledby="instance-firewall-title" className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-lg border border-hairline-divider bg-surface-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <header className="flex items-start justify-between border-b border-hairline-divider bg-[#FAFBFD] px-5 py-4">
          <div>
            <h2 id="instance-firewall-title" className="flex items-center gap-2 text-sm font-bold text-primary-ink"><ShieldCheck className="h-4 w-4 text-primary" />安全组/防火墙</h2>
            <p className="mt-1 text-[11px] text-secondary-ink">{instance.regionId || instance.name} · 仅管理该实例已关联的安全组</p>
          </div>
          <button type="button" aria-label="关闭安全组配置" onClick={onClose} className="rounded p-1 text-secondary-ink hover:bg-emphasis-layer hover:text-primary-ink"><X className="h-4 w-4" /></button>
        </header>

        <div className="space-y-5 overflow-y-auto p-5">
          {snapshotQuery.isLoading && <div role="status" aria-label="正在加载安全组规则" className="flex items-center justify-center gap-2 py-16 text-xs text-secondary-ink"><LoaderCircle className="h-4 w-4 animate-spin" />正在从阿里云加载安全组规则…</div>}

          {providerError && (
            <div role="alert" className="rounded border border-recovery-red/25 bg-recovery-red/[0.04] p-3 text-xs text-recovery-red">
              <p className="break-all">{providerError}</p>
              {isPermissionErrorMessage(providerError) && onViewPolicy && <button type="button" onClick={onViewPolicy} className="mt-2 font-semibold underline">查看 RAM 授权脚本</button>}
            </div>
          )}

          {!snapshotQuery.isLoading && !snapshotQuery.error && groups.length === 0 && <p className="rounded border border-dashed border-hairline-divider p-8 text-center text-xs text-secondary-ink">未发现已关联的安全组，请先重新同步实例拓扑。</p>}

          {selectedGroup && (
            <>
              <div className="flex flex-wrap items-end justify-between gap-3">
                <label className="min-w-64 space-y-1 text-xs font-medium text-primary-ink"><span>安全组</span><select aria-label="安全组" value={selectedGroup.id} onChange={(event) => { setSecurityGroupId(event.target.value); setPendingRuleId(null); }} className={inputClass}>{groups.map((group) => <option key={group.id} value={group.id}>{group.name} ({group.id})</option>)}</select></label>
                <span className="rounded bg-section-layer px-2.5 py-1.5 font-mono text-[10px] text-secondary-ink">{selectedGroup.regionId}</span>
              </div>

              <section className="space-y-3">
                <div className="flex gap-2 border-b border-hairline-divider">
                  {(['ingress', 'egress'] as const).map((value) => <button key={value} type="button" onClick={() => { setDirection(value); setPendingRuleId(null); }} className={`border-b-2 px-3 py-2 text-xs font-semibold ${direction === value ? 'border-primary text-primary' : 'border-transparent text-secondary-ink'}`}>{value === 'ingress' ? '入站规则' : '出站规则'}</button>)}
                </div>
                <RuleTable rules={rules} deleting={deleteMutation.isPending} pendingRuleId={pendingRuleId} onRequestDelete={setPendingRuleId} onConfirmDelete={confirmDelete} />
              </section>

              <form onSubmit={submitRule} className="space-y-3 rounded border border-hairline-divider bg-workspace-canvas p-4">
                <div><h3 className="text-xs font-bold text-primary-ink">新增{direction === 'ingress' ? '入站' : '出站'}规则</h3><p className="mt-1 text-[10px] text-secondary-ink">CIDR 表示{direction === 'ingress' ? '来源地址' : '目标地址'}；公网开放前请确认最小权限范围。</p></div>
                <div className="grid gap-3 md:grid-cols-4">
                  <label className="space-y-1 text-xs"><span>协议</span><select aria-label="协议" value={protocol} onChange={(event) => setProtocol(event.target.value)} className={inputClass}><option value="tcp">TCP</option><option value="udp">UDP</option><option value="icmp">ICMP</option><option value="gre">GRE</option><option value="all">ALL</option></select></label>
                  {isPortProtocol ? <><label className="space-y-1 text-xs"><span>起始端口</span><input aria-label="起始端口" type="number" min="1" max="65535" value={startPort} onChange={(event) => setStartPort(event.target.value)} className={inputClass} /></label><label className="space-y-1 text-xs"><span>结束端口</span><input aria-label="结束端口" type="number" min="1" max="65535" value={endPort} onChange={(event) => setEndPort(event.target.value)} className={inputClass} /></label></> : <div className="md:col-span-2"><span className="text-xs">端口范围</span><div className={`${inputClass} mt-1 text-secondary-ink`}>-1/-1</div></div>}
                  <label className="space-y-1 text-xs"><span>{direction === 'ingress' ? '来源 CIDR' : '目标 CIDR'}</span><input aria-label={direction === 'ingress' ? '来源 CIDR' : '目标 CIDR'} required value={cidr} onChange={(event) => setCidr(event.target.value)} className={inputClass} /></label>
                  <label className="space-y-1 text-xs"><span>策略</span><select aria-label="策略" value={policy} onChange={(event) => setPolicy(event.target.value)} className={inputClass}><option value="accept">允许</option><option value="drop">拒绝</option></select></label>
                  <label className="space-y-1 text-xs"><span>优先级</span><input aria-label="优先级" type="number" min="1" max="100" value={priority} onChange={(event) => setPriority(event.target.value)} className={inputClass} /></label>
                  <label className="space-y-1 text-xs md:col-span-2"><span>描述</span><input aria-label="描述" maxLength={512} value={description} onChange={(event) => setDescription(event.target.value)} className={inputClass} /></label>
                </div>
                {!portValid && <p className="text-[10px] text-recovery-red">端口必须在 1–65535 范围内，且起始端口不能大于结束端口。</p>}
                <div className="flex justify-end"><button type="submit" disabled={!formValid || createMutation.isPending} className="rounded bg-primary px-4 py-2 text-xs font-semibold text-white disabled:opacity-45">{createMutation.isPending ? '正在新增…' : '新增规则'}</button></div>
              </form>

              <section className="rounded border border-signal-amber/30 bg-signal-amber/[0.04] p-4">
                <div className="flex items-start gap-2"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-signal-amber" /><div><h3 className="text-xs font-bold text-primary-ink">Tailscale 直连/打洞端口</h3><p className="mt-1 text-[11px] leading-relaxed text-secondary-ink">将配置入站 <strong>UDP 41641/41641</strong>（来源 0.0.0.0/0）和出站 <strong>UDP 3478/3478</strong>（目标 0.0.0.0/0）。这会提高建立直连的机会，但不保证一定直连。</p></div></div>
                <label className="mt-3 flex items-start gap-2 text-[11px] text-primary-ink"><input type="checkbox" checked={tailscaleConfirmed} onChange={(event) => setTailscaleConfirmed(event.target.checked)} className="mt-0.5" /><span>我已了解入站 UDP 41641 将对整个 IPv4 Internet 开放</span></label>
                {(tailscaleMutation.data?.status === 'partial' || tailscaleMutation.data?.status === 'failed') && <div role="alert" className="mt-2 text-[11px] font-medium text-signal-amber"><p>{tailscaleMutation.data.status === 'partial' ? '规则仅部分配置成功' : '规则配置失败'}，已重新加载阿里云实际状态。</p>{tailscaleFailures.map((operation, index) => <p key={`${operation.rule.direction}-${index}`} className="mt-1 break-all font-mono text-[10px]">{operation.rule.direction}: {operation.message || '阿里云拒绝该规则'}</p>)}</div>}
                <div className="mt-3 flex justify-end"><button type="button" disabled={!tailscaleConfirmed || tailscaleMutation.isPending} onClick={() => tailscaleMutation.mutate(selectedGroup.id)} className="rounded border border-signal-amber/40 bg-signal-amber/10 px-3 py-2 text-xs font-semibold text-signal-amber disabled:opacity-45">{tailscaleMutation.isPending ? '正在配置…' : '配置 Tailscale 打洞端口'}</button></div>
              </section>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
