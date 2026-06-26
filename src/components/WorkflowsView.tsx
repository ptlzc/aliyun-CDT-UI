import React, { useEffect, useRef, useState } from 'react';
import { Check, CheckCircle2, Download, Layers, Loader2, RefreshCw, Terminal } from 'lucide-react';

import { WorkflowRun } from '../types';

interface WorkflowsViewProps {
  workflows: WorkflowRun[];
}

export default function WorkflowsView({ workflows }: WorkflowsViewProps) {
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string | null>(workflows[0]?.id ?? null);
  const [focusedTaskId, setFocusedTaskId] = useState<string | null>(workflows[0]?.tasks[0]?.id ?? null);
  const [autoScroll, setAutoScroll] = useState(true);
  const terminalEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!selectedWorkflowId && workflows[0]?.id) {
      setSelectedWorkflowId(workflows[0].id);
    }
  }, [selectedWorkflowId, workflows]);

  const activeWorkflow = workflows.find((item) => item.id === selectedWorkflowId) || workflows[0];

  useEffect(() => {
    if (!focusedTaskId && activeWorkflow?.tasks[0]?.id) {
      setFocusedTaskId(activeWorkflow.tasks[0].id);
    }
  }, [activeWorkflow, focusedTaskId]);

  useEffect(() => {
    if (autoScroll && terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [activeWorkflow?.logs, autoScroll]);

  const handleDownloadLogs = () => {
    if (!activeWorkflow) {
      return;
    }
    const textBlob = new Blob([activeWorkflow.logs.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(textBlob);
    const elem = document.createElement('a');
    elem.href = url;
    elem.download = `cdt_job_log_${activeWorkflow.id}.log`;
    document.body.appendChild(elem);
    elem.click();
    document.body.removeChild(elem);
  };

  const formatLogLine = (line: string) => {
    if (line.includes('SUCCESS') || line.includes('SUCCEEDED')) {
      return <span className="text-[#3fb950]">{line}</span>;
    }
    if (line.includes('ERROR') || line.includes('FAILED')) {
      return <span className="text-[#ff7b72]">{line}</span>;
    }
    return <span className="text-[#8b949e]">{line}</span>;
  };

  if (!activeWorkflow) {
    return (
      <div className="font-sans flex flex-col gap-6">
        <div className="flex items-center gap-3">
          <Layers className="w-5 h-5 text-primary" />
          <div>
            <h1 className="text-xl font-bold font-space text-primary-ink">自动化工作流中心</h1>
            <p className="text-xs text-secondary-ink mt-1">当前没有运行或历史作业。触发镜像导入、拓扑发现或实例置备后，这里会出现实时日志。</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="font-sans flex flex-col gap-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-3">
          <Layers className="w-5 h-5 text-primary" />
          <div>
            <h1 className="text-xl font-bold font-space text-primary-ink">自动化工作流中心</h1>
            <p className="text-xs text-secondary-ink mt-1">当前由后端任务状态和 runtime 事件流驱动。REST 提供快照，WebSocket 提供增量更新。</p>
          </div>
        </div>

        <div className="flex gap-2 text-xs">
          {workflows.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                setSelectedWorkflowId(item.id);
                setFocusedTaskId(item.tasks[0]?.id ?? null);
              }}
              className={`px-3 py-1.5 border rounded cursor-pointer transition-all ${
                selectedWorkflowId === item.id
                  ? 'border-primary bg-emphasis-layer text-primary font-semibold'
                  : 'border-hairline-divider bg-white text-on-surface-variant hover:bg-section-layer'
              }`}
            >
              作业: {item.name}
            </button>
          ))}
        </div>
      </div>

      <section className="bg-surface-white border border-hairline-divider rounded-lg p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-hairline-divider/40 pb-4 mb-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-primary-ink font-space">{activeWorkflow.name}</h2>
              <span className="bg-emphasis-layer border border-primary-fixed text-secondary font-mono px-2 py-0.5 rounded text-[10px] font-bold">{activeWorkflow.id}</span>
            </div>
            <p className="text-xs text-secondary-ink mt-1 flex items-center gap-2">
              <span>作用域: {activeWorkflow.targetRegion}</span>
              <span>触发者: {activeWorkflow.initiatedBy}</span>
            </p>
          </div>

          <span className="text-xs text-secondary-ink flex items-center gap-1.5 bg-workspace-canvas px-3 py-1.5 border rounded-full">
            <span className={`w-2 h-2 rounded-full ${activeWorkflow.status === 'Running' ? 'bg-signal-amber animate-pulse' : activeWorkflow.status === 'Success' ? 'bg-healthy-green' : activeWorkflow.status === 'Failed' ? 'bg-recovery-red' : 'bg-outline'}`} />
            <span>状态: {activeWorkflow.status}</span>
            <span className="font-mono text-primary font-bold pl-1">更新: {activeWorkflow.duration}</span>
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          <div className="lg:col-span-4 flex flex-col bg-surface-white border border-hairline-divider rounded-lg overflow-hidden shadow-sm">
            <header className="px-4 py-3 bg-[#EEF2F6] border-b border-hairline-divider flex items-center justify-between">
              <span className="text-xs font-bold text-primary-ink">任务步骤</span>
              <span className={`px-2 py-0.5 rounded text-[10px] border font-bold uppercase font-space ${activeWorkflow.status === 'Running' ? 'bg-[#FFF8E1] text-[#F57F17] border-[#FFECB3]' : activeWorkflow.status === 'Success' ? 'bg-green-50 text-[#1B5E20] border-[#c3e6cb]' : 'bg-red-50 text-[#b42318] border-[#fecdca]'}`}>
                {activeWorkflow.status}
              </span>
            </header>

            <div className="p-3 overflow-y-auto flex-1 flex flex-col gap-3 min-h-[400px]">
              {activeWorkflow.tasks.map((task) => {
                const isActive = task.id === focusedTaskId;
                const isTaskDone = task.status === 'Completed' || task.status === 'Success';
                const isTaskActive = task.status === 'In Progress';
                return (
                  <button
                    key={task.id}
                    onClick={() => setFocusedTaskId(task.id)}
                    className={`w-full text-left p-3 border rounded text-xs transition-all relative overflow-hidden cursor-pointer ${
                      isActive ? 'border-primary bg-[#E7EDF4]/40 shadow-sm' : 'border-[#EAEDF1] hover:bg-section-layer/40'
                    }`}
                  >
                    {isActive && <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary" />}
                    <div className="flex justify-between items-start mb-1">
                      <span className={`font-mono text-xs font-bold ${isActive ? 'text-primary' : 'text-primary-ink'}`}>{task.name}</span>
                      {isTaskDone ? (
                        <CheckCircle2 className="w-4 h-4 text-healthy-green" />
                      ) : isTaskActive ? (
                        <span className="text-[10px] text-signal-amber font-semibold flex items-center gap-1">
                          <RefreshCw className="w-3 h-3 animate-spin" />
                          进行中
                        </span>
                      ) : (
                        <span className="text-[10px] text-outline font-medium">{task.status}</span>
                      )}
                    </div>
                    <p className="text-[11px] text-[#667085] leading-relaxed">{task.description}</p>
                    {task.progress !== undefined && (
                      <div className="mt-3 bg-white p-2.5 border rounded-sm font-mono text-[10px] text-[#424751] flex flex-col gap-1.5 shadow-2xs">
                        <div className="w-full bg-[#FAFBFD] rounded-full h-1 overflow-hidden border">
                          <div className="bg-primary h-full progress-bar duration-300 transition-all" style={{ width: `${task.progress}%` }} />
                        </div>
                        <div className="flex justify-between text-[9px] text-[#8b949e]">
                          <span>执行进度</span>
                          <span className="font-bold text-primary">{task.progress}%</span>
                        </div>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="lg:col-span-8 flex flex-col bg-[#0d1117] border border-[#30363d] rounded-lg overflow-hidden shadow-sm">
            <header className="px-4 py-3 bg-[#161b22] border-b border-[#30363d] flex justify-between items-center select-none shrink-0">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-[#8b949e]" />
                <span className="text-xs font-mono text-[#c9d1d9] font-bold">同步编排审计日志</span>
              </div>

              <div className="flex items-center gap-4 text-[#8b949e] text-xs">
                <label className="flex items-center gap-1.5 font-mono text-[11px] cursor-pointer hover:text-white transition-colors">
                  <input
                    type="checkbox"
                    checked={autoScroll}
                    onChange={(event) => setAutoScroll(event.target.checked)}
                    className="rounded text-primary bg-[#0d1117] border-[#30363d] focus:ring-0 focus:ring-offset-0 h-3 w-3"
                  />
                  <span>自动滚动</span>
                </label>
                <button onClick={handleDownloadLogs} className="p-1 hover:text-white rounded transition-colors cursor-pointer" title="下载系统日志">
                  <Download className="w-4 h-4" />
                </button>
              </div>
            </header>

            <div className="flex-1 p-5 overflow-y-auto terminal-scroll font-mono text-xs leading-relaxed max-h-[480px] min-h-[400px] h-[400px] bg-[#0d1117] flex flex-col gap-1 text-[#c9d1d9]">
              {activeWorkflow.logs.length > 0 ? (
                activeWorkflow.logs.map((logLine, index) => (
                  <div key={`${activeWorkflow.id}-${index}`} className="transition-all py-0.5">
                    {formatLogLine(logLine)}
                  </div>
                ))
              ) : (
                <div className="text-[#8b949e]">当前任务还没有日志输出。</div>
              )}
              {activeWorkflow.status === 'Running' && (
                <div className="flex items-center gap-2 mt-2 font-semibold">
                  <span className="text-[#c9d1d9]">$ runtime stream connected ...</span>
                  <span className="bg-[#c9d1d9] w-1.5 h-3.5 inline-block animate-pulse shrink-0" />
                </div>
              )}
              <div ref={terminalEndRef} />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
