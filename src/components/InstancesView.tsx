import React, { useState, useMemo } from 'react';
import { ECSInstance } from '../types';
import { Plus, Filter, Play, Square, Settings, Terminal, Activity, AlertTriangle, Cpu, HardDrive, Network, MapPin, Check, RefreshCw, X, ChevronDown, ChevronUp } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface InstancesViewProps {
  instances: ECSInstance[];
  setInstances: React.Dispatch<React.SetStateAction<ECSInstance[]>>;
}

export default function InstancesView({ instances, setInstances }: InstancesViewProps) {
  const [filterText, setFilterText] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  
  // Interactive UI states per instance
  const [activeShellId, setActiveShellId] = useState<string | null>(null);
  const [activeChartId, setActiveChartId] = useState<string | null>(null);
  const [shellCommands, setShellCommands] = useState<{ [key: string]: { cmd: string; output: string[] } }>({});
  const [tempState, setTempState] = useState<{ [key: string]: 'starting' | 'stopping' | null }>({});

  // ECS creation overlay state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState('ecs.g6.large');
  const [newZone, setNewZone] = useState('cn-hangzhou-i');
  const [newLimit, setNewLimit] = useState(1); // 1TB

  // Filter machines
  const filtered = useMemo(() => {
    return instances.filter((inst) => {
      const matchesText =
        inst.name.toLowerCase().includes(filterText.toLowerCase()) ||
        inst.id.toLowerCase().includes(filterText.toLowerCase()) ||
        inst.type.toLowerCase().includes(filterText.toLowerCase());

      if (statusFilter === 'ALL') return matchesText;
      return matchesText && inst.status === statusFilter;
    });
  }, [instances, filterText, statusFilter]);

  // Handle Power Toggling
  const togglePower = (instId: string, currentStatus: ECSInstance['status']) => {
    if (tempState[instId]) return; // process active

    const isStarting = currentStatus === 'Stopped';
    
    // Step 1: Set temporary loading state
    setTempState(prev => ({ ...prev, [instId]: isStarting ? 'starting' : 'stopping' }));

    // Step 2: Trigger state change after 1.5 seconds simulated cloud operation
    setTimeout(() => {
      setInstances(prev =>
        prev.map(inst => {
          if (inst.id === instId) {
            const nextStatus = isStarting ? 'Running' : 'Stopped';
            const nextIp = isStarting ? `47.97.${Math.floor(100 + Math.random() * 150)}.${Math.floor(10 + Math.random() * 80)}` : '未分配';
            return {
              ...inst,
              status: nextStatus,
              publicIp: nextIp,
              alerts: isStarting ? [] : inst.alerts // clear CPU alarms on power down
            };
          }
          return inst;
        })
      );
      setTempState(prev => ({ ...prev, [instId]: null }));
    }, 1500);
  };

  // Safe manual addition of ECS
  const handleCreateECS = () => {
    if (!newName) {
      alert('请输入实例名称');
      return;
    }

    const newInst: ECSInstance = {
      id: `i-bp${Math.random().toString(36).substring(2, 7)}`,
      name: newName,
      status: 'Running',
      type: newType,
      zone: newZone,
      publicIp: `47.97.102.${Math.floor(10 + Math.random() * 80)}`,
      trafficUsed: 0,
      trafficLimit: newLimit * 1000,
      alerts: []
    };

    setInstances(prev => [...prev, newInst]);
    setShowCreateModal(false);
    setNewName('');
  };

  // Simulated inline shell runner
  const runMockShell = (instId: string, ecsName: string, cmd: string) => {
    if (!cmd.trim()) return;

    let reply: string[] = [];
    const commandClean = cmd.trim().toLowerCase();

    if (commandClean === 'help') {
      reply = [
        `$ ${cmd}`,
        `Available instructions for CDT cluster node [${ecsName}]:`,
        `  help             - list cluster shell commands`,
        `  status           - print instance kernel and uptime info`,
        `  vswitch-ping     - inspect binding response to vswitch-vsw-bp1xyz`,
        `  clear            - clear stdout buffer logs`
      ];
    } else if (commandClean === 'status') {
      reply = [
        `$ ${cmd}`,
        `OS: Aliyun Linux 3 x64 20G alibase`,
        `Kernel: 5.10.134-13.1.al8.x86_64`,
        `Daemon uptime: ${Math.floor(2 + Math.random() * 200)} hours`,
        `RAM usage: ${Math.floor(30 + Math.random() * 40)}% / 100%`,
        `Vswitch CIDR Block: 192.168.1.0/24 verified.`
      ];
    } else if (commandClean === 'vswitch-ping') {
      reply = [
        `$ ${cmd}`,
        `PING vswitch-vsw-bp1xyz.cn-hangzhou (192.168.1.1) 56(84) bytes of data.`,
        `64 bytes from 192.168.1.1: icmp_seq=1 ttl=64 time=0.45 ms`,
        `64 bytes from 192.168.1.1: icmp_seq=2 ttl=64 time=0.52 ms`,
        `--- vswitch-vsw-bp1xyz ping statistics ---`,
        `2 packets transmitted, 2 received, 0% packet loss, time 1002ms`,
        `rtt min/avg/max/mdev = 0.45/0.48/0.52/0.05 ms`
      ];
    } else if (commandClean === 'clear') {
      setShellCommands(prev => ({
        ...prev,
        [instId]: { cmd: '', output: [`Mock Shell console bound to ${ecsName}. Type 'help' for instructions.`] }
      }));
      return;
    } else {
      reply = [
        `$ ${cmd}`,
        `sh: command not found: ${cmd}. Type 'help' for support.`
      ];
    }

    setShellCommands(prev => {
      const existing = prev[instId]?.output || [];
      return {
        ...prev,
        [instId]: {
          cmd: '',
          output: [...existing, ...reply]
        }
      };
    });
  };

  return (
    <div className="font-sans flex flex-col gap-6">
      {/* Top action header section */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-end gap-4">
        <div>
          <h1 className="text-xl font-bold font-space text-primary-ink flex items-center gap-2">
            ECS 实例列表
          </h1>
          <p className="text-xs text-secondary-ink mt-1">
            监控和调配跨物理隔离 AZ 的阿里云云服务器实例，绑定虚拟专用网络（VPC）并配置宽带限额。
          </p>
        </div>

        <div className="flex bg-surface-white border border-hairline-divider rounded p-1 text-xs font-medium text-primary-ink shrink-0 select-none items-center gap-2">
          <span className="text-secondary-ink font-bold font-sans uppercase mr-1 pl-1 text-[10px]">过滤网卡：</span>
          {['ALL', 'Running', 'High CPU', 'Stopped'].map(st => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1 text-[11px] rounded transition-colors cursor-pointer ${
                statusFilter === st
                  ? 'bg-primary text-white font-semibold'
                  : 'text-on-surface-variant hover:bg-emphasis-layer'
              }`}
            >
              {st === 'ALL' ? '全部' : st}
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          <div className="relative w-48">
            <Filter className="absolute left-3 top-2.5 text-outline w-3.5 h-3.5" />
            <input
              type="text"
              value={filterText}
              onChange={e => setFilterText(e.target.value)}
              placeholder="搜索实例ID、名称、规格..."
              className="w-full pl-9 pr-3 py-1.5 border border-hairline-divider bg-surface-white rounded text-xs select-none focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary placeholder-outline-variant font-medium"
            />
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-primary text-white text-xs rounded hover:bg-primary-container font-semibold transition-colors flex items-center gap-2 shadow-sm cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>创建 ECS</span>
          </button>
        </div>
      </div>

      {/* Bento Grid Layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filtered.map((inst) => {
          const loadingStatus = tempState[inst.id];
          const isBooting = loadingStatus === 'starting';
          const isStopping = loadingStatus === 'stopping';

          // Set left border indicator accent
          let accentBorder = 'border-l-[4px] border-l-healthy-green';
          if (inst.status === 'High CPU') accentBorder = 'border-l-[4px] border-l-signal-amber';
          if (inst.status === 'Stopped') accentBorder = 'border-l-[4px] border-l-outline-variant';

          // Calculating Traffic indicators
          let trafficDisplayStr = '';
          let remainingDisplayStr = '';
          let progressVal = 0;
          let isWarningOnLimit = false;

          if (inst.status === 'Stopped') {
            trafficDisplayStr = `85% / ${inst.trafficLimit / 1000} TB`;
            remainingDisplayStr = `剩余 ${Math.floor(inst.trafficLimit * 0.85)} GB`;
            progressVal = 85; 
          } else {
            const usedGb = inst.trafficUsed;
            const limitGb = inst.trafficLimit;
            const remainingGb = limitGb - usedGb;
            progressVal = Math.floor((usedGb / limitGb) * 100);

            if (limitGb >= 1000) {
              trafficDisplayStr = `${usedGb} GB / ${limitGb / 1000} TB`;
            } else {
              trafficDisplayStr = `${usedGb} GB / ${limitGb} GB`;
            }

            if (remainingGb >= 1000) {
              remainingDisplayStr = `剩余 ${(remainingGb / 1000).toFixed(1)} TB`;
            } else {
              remainingDisplayStr = `剩余 ${remainingGb} GB`;
            }

            if (progressVal > 80) isWarningOnLimit = true;
          }

          return (
            <div 
              key={inst.id} 
              className={`bg-surface-white border rounded-lg p-5 hover:shadow-md transition-shadow relative overflow-hidden flex flex-col gap-4 ${
                inst.status === 'High CPU' ? 'border-l-signal-amber shadow-[0_0_8px_rgba(180,83,9,0.04)]' : 'border-hairline-divider'
              }`}
            >
              <div className={`absolute top-0 left-0 bottom-0 w-1 ${
                inst.status === 'High CPU' ? 'bg-signal-amber' : inst.status === 'Running' ? 'bg-healthy-green' : 'bg-outline-variant'
              }`} />

              {/* Card top banner details */}
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-bold text-sm text-primary-ink flex items-center gap-2">
                    {inst.name}
                  </h3>
                  <span className="font-mono text-[11px] text-outline mt-1 block select-all">
                    {inst.id}
                  </span>
                </div>

                {/* Machine State details */}
                <div className="flex flex-col gap-1 items-end">
                  {loadingStatus ? (
                    <span className="bg-emphasis-layer border border-primary-fixed text-primary px-2.5 py-1 rounded text-[10px] font-semibold flex items-center gap-1">
                      <RefreshCw className="w-3 h-3 animate-spin text-primary" />
                      {isBooting ? '正在启动...' : '正在入库停机...'}
                    </span>
                  ) : (
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded border text-[10px] font-bold ${
                      inst.status === 'Running' ? 'bg-[#E8F5E9] text-[#1B5E20] border-[#C8E6C9]' : inst.status === 'High CPU' ? 'bg-[#FFF8E1] text-[#F57F17] border-[#FFECB3]' : 'bg-section-layer text-outline border-hairline-divider'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${
                        inst.status === 'Running' ? 'bg-healthy-green animate-pulse' : inst.status === 'High CPU' ? 'bg-signal-amber animate-pulse' : 'bg-outline'
                      }`} />
                      {inst.status === 'High CPU' ? 'High CPU' : inst.status}
                    </span>
                  )}
                </div>
              </div>

              {/* Specifications Block Card */}
              <div className="bg-workspace-canvas rounded p-3 text-xs flex flex-col gap-3 border border-hairline-divider/50">
                <div className="grid grid-cols-2 gap-y-2">
                  <div>
                    <span className="block text-[10px] font-bold text-secondary-ink uppercase tracking-wider mb-0.5 font-sans">规格类型 Type</span>
                    <span className="font-mono text-xs text-primary-ink font-semibold">{inst.type}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] font-bold text-secondary-ink uppercase tracking-wider mb-0.5 font-sans">交换机网域 Zone</span>
                    <span className="text-xs text-primary-ink font-semibold">{inst.zone}</span>
                  </div>
                </div>

                {/* Static public ip detail mapping */}
                <div>
                  <span className="block text-[10px] font-bold text-secondary-ink uppercase tracking-wider mb-1 font-sans">绑定公网 IP</span>
                  <div className="bg-surface-white border border-hairline-divider px-2.5 py-1 rounded flex items-center justify-between font-mono text-xs text-primary-ink shadow-2xs">
                    <span className={inst.publicIp === '未分配' ? 'text-outline italic' : 'font-semibold'}>
                      {inst.publicIp}
                    </span>
                    {inst.publicIp !== '未分配' && <span className="text-[10px] text-healthy-green font-sans font-bold">✓ Bound</span>}
                  </div>
                </div>

                {/* Traffic remaining display progress bar */}
                <div className="flex flex-col gap-1 mt-1">
                  <span className="block text-[10px] font-bold text-secondary-ink uppercase tracking-wider font-sans">
                    {inst.status === 'Stopped' ? '剩余流量 (Remaining Traffic)' : '网卡出口流量监测 (Traffic Usage)'}
                  </span>
                  <div className="w-full bg-surface-white rounded-full h-1.5 overflow-hidden border border-hairline-divider/30">
                    <div 
                      className={`h-full rounded-full transition-all duration-300 ${
                        isWarningOnLimit ? 'bg-recovery-red' : inst.status === 'High CPU' ? 'bg-signal-amber' : 'bg-primary-container'
                      }`} 
                      style={{ width: `${progressVal}%` }} 
                    />
                  </div>
                  <div className="flex justify-between items-center text-[10px] font-medium font-mono">
                    <span className="text-primary-ink">{trafficDisplayStr}</span>
                    <span className={isWarningOnLimit ? 'text-recovery-red font-bold' : 'text-secondary-ink'}>
                      {remainingDisplayStr}
                    </span>
                  </div>
                </div>
              </div>

              {/* Warning box if High CPU */}
              {inst.status === 'High CPU' && inst.alerts.length > 0 && (
                <div className="bg-signal-amber/[0.04] border border-signal-amber/20 p-2.5 rounded-md flex gap-2 items-start text-[11px] text-signal-amber">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <div className="flex-1 space-y-0.5">
                    <div className="font-semibold">节点监控报警 (CPU Busy Alert)</div>
                    {inst.alerts.map((al, ai) => (
                      <div key={ai} className="text-[10px] leading-relaxed text-secondary-ink">{al}</div>
                    ))}
                  </div>
                </div>
              )}

              {/* Expandable panels wrapper */}
              <AnimatePresence>
                {/* 1. Terminal Panel */}
                {activeShellId === inst.id && inst.status !== 'Stopped' && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.15 }}
                    className="overflow-hidden bg-[#0d1117] rounded-md border border-[#30363d]"
                  >
                    <div className="flex justify-between items-center bg-[#161b22] px-3 py-1.5 border-b border-[#30363d] text-white text-[10px] font-mono select-none">
                      <span className="text-[#8b949e]">SSH SSH/sh login: root@ali-cdt-ecs</span>
                      <button 
                        onClick={() => setActiveShellId(null)}
                        className="text-[#8b949e] hover:text-white px-1"
                      >
                        ✕
                      </button>
                    </div>
                    {/* Live console terminal stdout */}
                    <div className="p-3 font-mono text-[11px] text-[#c9d1d9] max-h-44 overflow-y-auto terminal-scroll flex flex-col gap-1 select-all h-36">
                      {(shellCommands[inst.id]?.output || [`Mock Shell console bound to ${inst.name}. Type 'help' for instructions.`]).map((log, idx) => (
                        <div key={idx} className={log.startsWith('$') ? 'text-[#58a6ff]' : log.includes('SUCCESS') ? 'text-[#3fb950]' : 'text-[#8b949e]'}>
                          {log}
                        </div>
                      ))}
                      <div className="flex items-center gap-1.5 mt-1 select-none">
                        <span className="text-[#79c0ff] shrink-0">❯</span>
                        <input
                          type="text"
                          value={shellCommands[inst.id]?.cmd || ''}
                          onChange={e => setShellCommands(prev => ({
                            ...prev,
                            [inst.id]: {
                              cmd: e.target.value,
                              output: prev[inst.id]?.output || [`Mock Shell console bound to ${inst.name}. Type 'help' for instructions.`]
                            }
                          }))}
                          onKeyDown={e => {
                            if (e.key === 'Enter') {
                              runMockShell(inst.id, inst.name, shellCommands[inst.id]?.cmd || '');
                            }
                          }}
                          placeholder="vswitch-ping..."
                          className="bg-transparent text-white border-none w-full p-0 focus:outline-none focus:ring-0 text-[11px] font-mono leading-tight"
                        />
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* 2. Monitoring Metrics visual panel */}
                {activeChartId === inst.id && inst.status !== 'Stopped' && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.15 }}
                    className="overflow-hidden bg-section-layer rounded border border-hairline-divider p-3 flex flex-col gap-2"
                  >
                    <div className="flex justify-between items-center text-[10px] text-secondary-ink font-bold uppercase tracking-wider select-none">
                      <span>节点健康图 (Simulated Metric CPU Area)</span>
                      <div className="flex gap-2">
                        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-primary" /> CPU</span>
                        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-signal-amber" /> Network</span>
                      </div>
                    </div>

                    {/* Styled metric bars representation mimicking live Area Chart */}
                    <div className="h-16 flex items-end justify-between px-2 pt-3">
                      {[30, 45, 32, 60, 45, 90, 85, 76, inst.status === 'High CPU' ? 94 : 45, inst.status === 'High CPU' ? 92 : 40].map((val, idx) => {
                        const isDbHigh = inst.status === 'High CPU' && val > 80;
                        return (
                          <div key={idx} className="flex-1 flex flex-col items-center gap-1 group relative">
                            <div 
                              className={`w-full rounded-t-sm transition-all duration-300 ${isDbHigh ? 'bg-signal-amber hover:bg-signal-amber/80' : 'bg-primary hover:bg-primary/80'}`} 
                              style={{ height: `${val * 0.5}px` }} 
                            />
                            <span className="absolute -top-3 text-[8px] bg-primary-ink text-white rounded px-1 scale-0 group-hover:scale-100 transition-all z-10 font-mono">
                              {val}%
                            </span>
                          </div>
                        );
                      })}
                    </div>
                    <div className="flex justify-between items-center text-[9px] text-[#667085] leading-none px-1">
                      <span>-30 Min</span>
                      <span>-15 Min</span>
                      <span>Realtime Live</span>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Bottom footer button actions */}
              <div className="mt-auto flex justify-between items-center pt-3 border-t border-hairline-divider/50">
                <div className="flex gap-1">
                  {/* Play/Stop Trigger */}
                  <button
                    onClick={() => togglePower(inst.id, inst.status)}
                    disabled={loadingStatus !== undefined}
                    className={`p-1.5 rounded transition-all cursor-pointer ${
                      inst.status === 'Stopped' 
                        ? 'text-outline hover:text-white hover:bg-healthy-green/20' 
                        : 'text-outline hover:text-white hover:bg-recovery-red/20'
                    }`}
                    title={inst.status === 'Stopped' ? '启动实例 (Power ON)' : '停止实例 (Power OFF)'}
                  >
                    {inst.status === 'Stopped' ? (
                      <Play className="w-4 h-4 fill-current shrink-0" />
                    ) : (
                      <Square className="w-4 h-4 fill-current shrink-0" />
                    )}
                  </button>

                  {/* Open mock shell */}
                  <button
                    disabled={inst.status === 'Stopped'}
                    onClick={() => {
                      setActiveShellId(activeShellId === inst.id ? null : inst.id);
                      setActiveChartId(null);
                    }}
                    className={`p-1.5 rounded transition-colors ${
                      inst.status === 'Stopped' ? 'opacity-30 cursor-not-allowed' : 'text-outline hover:bg-emphasis-layer hover:text-primary-ink cursor-pointer'
                    }`}
                    title="容器 SSH 命令登录"
                  >
                    <Terminal className="w-4 h-4 shrink-0" />
                  </button>

                  {/* Open metrics monitor Area chart */}
                  <button
                    disabled={inst.status === 'Stopped'}
                    onClick={() => {
                      setActiveChartId(activeChartId === inst.id ? null : inst.id);
                      setActiveShellId(null);
                    }}
                    className={`p-1.5 rounded transition-colors ${
                      inst.status === 'Stopped' ? 'opacity-30 cursor-not-allowed' : 'text-outline hover:bg-emphasis-layer hover:text-primary-ink cursor-pointer'
                    }`}
                    title="资源状态指标"
                  >
                    <Activity className="w-4 h-4 shrink-0" />
                  </button>
                </div>

                <div className="flex gap-2.5 items-center">
                  <span className="text-[11px] font-mono font-semibold text-[#8b949e]">
                    CDT: {inst.status === 'Stopped' ? 'OF' : 'ON'}
                  </span>
                  <div className="h-3.5 w-[1px] bg-hairline-divider" />
                  <button 
                    onClick={() => alert(`虚拟计算隔离详情 -- ${inst.name}\n规格: ${inst.type}\n可用区: ${inst.zone}\n内网 IP: 192.168.1.${Math.floor(2 + Math.random() * 50)}`)}
                    className="text-primary hover:text-primary-container text-xs font-semibold cursor-pointer"
                  >
                    Manage
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Creation ECS Modal Overlay */}
      <AnimatePresence>
        {showCreateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-primary-ink/45 backdrop-blur-xs font-sans">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white border border-hairline-divider w-full max-w-md rounded-lg shadow-xl overflow-hidden flex flex-col"
            >
              <header className="px-5 py-3.5 border-b border-hairline-divider bg-section-layer flex justify-between items-center text-primary-ink">
                <span className="text-sm font-bold font-space flex items-center gap-1.5">
                  <Cpu className="w-4 h-4 text-primary" />
                  创建配置 Aliyun ECS 实例
                </span>
                <button 
                  onClick={() => setShowCreateModal(false)}
                  className="text-outline hover:text-primary-ink p-1 rounded-full cursor-pointer hover:bg-[#E1E2E9]/45"
                >
                  <X className="w-4 h-4" />
                </button>
              </header>

              <div className="p-5 flex flex-col gap-4 text-xs">
                {/* Name */}
                <div className="flex flex-col gap-1.5">
                  <label className="font-bold text-secondary-ink uppercase select-none">主机别称 (Instance Name) *</label>
                  <input
                    type="text"
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    placeholder="例如: prod-web-front-02"
                    className="w-full px-3 py-2 border border-hairline-divider rounded focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary text-primary-ink font-semibold"
                  />
                </div>

                {/* Instance specs type */}
                <div className="flex flex-col gap-1.5">
                  <label className="font-bold text-secondary-ink uppercase select-none">机型配置 (ECS Spec Types)</label>
                  <select
                    value={newType}
                    onChange={e => setNewType(e.target.value)}
                    className="w-full px-3 py-2 border border-hairline-divider rounded bg-white text-primary-ink font-mono focus:border-primary focus:outline-none"
                  >
                    <option value="ecs.g6.large">ecs.g6.large (2 vCPU / 8 GB - 通用型)</option>
                    <option value="ecs.c6.xlarge">ecs.c6.xlarge (4 vCPU / 8 GB - 计算型)</option>
                    <option value="ecs.r6.2xlarge">ecs.r6.2xlarge (8 vCPU / 64 GB - 内存型)</option>
                  </select>
                </div>

                {/* Region Zone */}
                <div className="flex flex-col gap-1.5">
                  <label className="font-bold text-secondary-ink uppercase select-none">分配可用区 (Availability Zone)</label>
                  <select
                    value={newZone}
                    onChange={e => setNewZone(e.target.value)}
                    className="w-full px-3 py-2 border border-hairline-divider rounded bg-white text-primary-ink focus:border-primary focus:outline-none"
                  >
                    <option value="cn-hangzhou-i">cn-hangzhou-i (可用区 I)</option>
                    <option value="cn-hangzhou-h">cn-hangzhou-h (可用区 H)</option>
                    <option value="cn-beijing-a">cn-beijing-a (可用区 A)</option>
                  </select>
                </div>

                {/* Data limit */}
                <div className="flex flex-col gap-1.5">
                  <label className="font-bold text-secondary-ink uppercase select-none">网络带宽及限额流量 (Traffic Limit)</label>
                  <select
                    value={newLimit}
                    onChange={e => setNewLimit(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-hairline-divider rounded bg-white text-primary-ink focus:border-primary focus:outline-none font-semibold"
                  >
                    <option value={0.5}>500 GB / 月度限额</option>
                    <option value={1}>1 TB / 月度限额</option>
                    <option value={2}>2 TB / 月度限额</option>
                  </select>
                </div>

                <div className="flex font-medium text-secondary-ink leading-relaxed items-start gap-2 bg-[#E7EDF4]/30 border p-3 rounded mt-1 text-[11px]">
                  <AlertTriangle className="w-4 h-4 text-secondary shrink-0 mt-0.5" />
                  <span>
                    新建的 ECS 将默认分配弹性公网 IP 并绑定在Alibash操作系统下。可一键通过底部控制台进行 Shell ping 连通探测。
                  </span>
                </div>

                <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-hairline-divider">
                  <button
                    onClick={() => setShowCreateModal(false)}
                    className="px-4 py-2 border border-hairline-divider text-primary-ink hover:bg-emphasis-layer rounded font-medium transition-colors cursor-pointer"
                  >
                    取消
                  </button>
                  <button
                    onClick={handleCreateECS}
                    className="px-4 py-2 bg-primary text-white hover:bg-primary-container font-semibold rounded shadow-sm transition-colors cursor-pointer"
                  >
                    确认部署下单
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
