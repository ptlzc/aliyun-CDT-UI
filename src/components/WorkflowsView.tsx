import React, { useState, useEffect, useRef } from 'react';
import { WorkflowRun, WorkflowTask } from '../types';
import { PlayCircle, StopCircle, RefreshCw, Layers, Check, User, ChevronRight, Terminal, Download, Sparkles, CheckCircle2, Loader2, ArrowLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface WorkflowsViewProps {
  workflows: WorkflowRun[];
  setWorkflows: React.Dispatch<React.SetStateAction<WorkflowRun[]>>;
}

export default function WorkflowsView({ workflows, setWorkflows }: WorkflowsViewProps) {
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string | null>('wkf-8a7b6c5d');
  const [autoScroll, setAutoScroll] = useState(true);
  const [focusedTaskId, setFocusedTaskId] = useState<string>('task-ecs-provisioning');
  const terminalEndRef = useRef<HTMLDivElement | null>(null);

  const activeWorkflow = workflows.find((w) => w.id === selectedWorkflowId) || workflows[0];

  // Auto scroll terminal logs
  useEffect(() => {
    if (autoScroll && terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [activeWorkflow?.logs, autoScroll]);

  // Automated workflow simulator loop
  useEffect(() => {
    const activeRunning = workflows.filter(w => w.status === 'Running');
    if (activeRunning.length === 0) return;

    // Set a cycle to increment the active tasks if it's in progress
    const timer = setInterval(() => {
      setWorkflows((prevWorkflows) =>
        prevWorkflows.map((wkf) => {
          if (wkf.status !== 'Running') return wkf;

          const currentTaskIndex = wkf.activeStepIndex;
          const currentTask = wkf.tasks[currentTaskIndex];

          if (!currentTask) {
            // All steps complete! Set workflow to Success
            return {
              ...wkf,
              status: 'Success',
              duration: '05:42',
              logs: [
                ...wkf.logs,
                `[2026-06-16 19:07:22 UTC] SUCCESS Integration finished successfully. All cloud services bound.`,
                `[2026-06-16 19:07:23 UTC] INFO Completed validation closure. Closing runner.`
              ]
            };
          }

          // If current task is in progress, increase its progress
          if (currentTask.status === 'In Progress') {
            const currentProgress = currentTask.progress || 0;
            if (currentProgress < 100) {
              const nextProgress = Math.min(currentProgress + 15, 100);
              const updatedTasks = wkf.tasks.map((t, idx) =>
                idx === currentTaskIndex ? { ...t, progress: nextProgress } : t
              );

              // Inject intermediate log line
              const logTickMsg = `[2026-06-16 19:04:${30 + Math.floor(Math.random() * 20)} UTC] INFO ${currentTask.name}: Provision progress at ${nextProgress}%...`;

              return {
                ...wkf,
                tasks: updatedTasks,
                logs: [...wkf.logs, logTickMsg]
              };
            } else {
              // Task finished! Set to Completed / Success, and advance to next index
              const updatedTasks = wkf.tasks.map((t, idx) =>
                idx === currentTaskIndex ? { ...t, status: 'Completed' as const, progress: 100 } : t
              );

              const nextIndex = currentTaskIndex + 1;
              const nextTask = wkf.tasks[nextIndex];

              const nextTaskStartedLogs = nextTask
                ? [
                    `[2026-06-16 19:05:10 UTC] SUCCESS Task ${currentTask.name} succeeded.`,
                    `[2026-06-16 19:05:15 UTC] INFO Initiating task ${nextTask.name}: ${nextTask.description}`,
                  ]
                : [
                    `[2026-06-16 19:05:10 UTC] SUCCESS Task ${currentTask.name} succeeded.`,
                    `[2026-06-16 19:05:12 UTC] INFO All integration tasks complete. Starting stage 4: Final Validation audit.`,
                  ];

              // Update next tasks to "In Progress"
              const finalTasks = updatedTasks.map((t, idx) =>
                idx === nextIndex ? { ...t, status: 'In Progress' as const, progress: 10 } : t
              );

              return {
                ...wkf,
                activeStepIndex: nextIndex,
                tasks: finalTasks,
                logs: [...wkf.logs, ...nextTaskStartedLogs]
              };
            }
          } else if (currentTask.status === 'Pending') {
            // Task in pending state (e.g. step 4) - activate it
            const finalTasks = wkf.tasks.map((t, idx) =>
              idx === currentTaskIndex ? { ...t, status: 'In Progress' as const, progress: 10 } : t
            );
            return {
              ...wkf,
              tasks: finalTasks,
              logs: [...wkf.logs, `[2026-06-16 19:05:30 UTC] INFO Starting Validation block auditee services.`]
            };
          }

          return wkf;
        })
      );
    }, 4500);

    return () => clearInterval(timer);
  }, [workflows]);

  // Cancel Workflow runner manually
  const handleCancelWorkflow = (wkfId: string) => {
    if (confirm('确认强行终止执行当前 CDT 资源编排流水？这可能会产生孤立的子资源，需要人工云端核销。')) {
      setWorkflows((prev) =>
        prev.map((wkf) => {
          if (wkf.id === wkfId) {
            return {
              ...wkf,
              status: 'Failed',
              logs: [
                ...wkf.logs,
                `[2026-06-16 19:05:55 UTC] [FATAL ERROR] Workflow run cancelled manually by administrative staff limit.`,
                `[2026-06-16 19:05:56 UTC] [ABORTED] Releasing deployment locks. Releasing incomplete provisioning block.`
              ]
            };
          }
          return wkf;
        })
      );
    }
  };

  // Trigger manual simulation step helper
  const handleAdvanceManually = () => {
    setWorkflows((prev) =>
      prev.map((wkf) => {
        if (wkf.id !== activeWorkflow.id || wkf.status !== 'Running') return wkf;
        
        const idx = wkf.activeStepIndex;
        // set active task to complete, open next
        const updatedTasks = wkf.tasks.map((t, k) => {
          if (k === idx) return { ...t, status: 'Completed' as const, progress: 100 };
          if (k === idx + 1) return { ...t, status: 'In Progress' as const, progress: 20 };
          return t;
        });

        const nextIndex = Math.min(idx + 1, wkf.tasks.length);
        const nextLogMsg = nextIndex < wkf.tasks.length 
          ? `[ADMIN FORCE ADVANCE] Advancing manual deployment pipeline to node: ${wkf.tasks[nextIndex].name}`
          : `[ADMIN FORCE COMPLETE] Flow completed manually under supervisor permission.`;

        const finalStatus = nextIndex >= wkf.tasks.length ? 'Success' : 'Running';

        return {
          ...wkf,
          activeStepIndex: nextIndex,
          status: finalStatus,
          tasks: updatedTasks,
          logs: [...wkf.logs, nextLogMsg]
        };
      })
    );
  };

  // Restart active workflow back to in progress dummy loop
  const handleRestartWorkflowDemo = (wkfId: string) => {
    setWorkflows((prev) =>
      prev.map((w) => {
        if (w.id === wkfId) {
          return {
            ...w,
            status: 'Running',
            activeStepIndex: 2,
            tasks: [
              { id: 'task-vpc-verify', name: 'task-vpc-verify', status: 'Completed', description: 'Verified vSwitch and Security Group bindings.' },
              { id: 'task-ecs-provisioning', name: 'task-ecs-provisioning', status: 'In Progress', description: 'Preparing CreateInstance API payload. Calling Aliyun RunInstances API and tracking instance power states.', properties: { InstanceType: 'ecs.g7.xlarge', ImageId: 'aliyun_3_x64_20G_alibase_20231220.vhd', Count: 3 }, progress: 15 },
              { id: 'task-eip-allocate', name: 'task-eip-allocate', status: 'Pending', description: 'Allocating regional Elastic IP pool and performing direct binding associations.' },
              { id: 'task-slb-register', name: 'task-slb-register', status: 'Pending', description: 'Registering newly provisioned virtual server targets under regional Load Balancer groups.' }
            ],
            logs: [
              '[2023-10-27 14:32:01 UTC] INFO Starting workflow execution wkf-8a7b6c5d',
              '[2023-10-27 14:32:02 UTC] INFO Engine context initialized. Target: cn-hangzhou',
              '[2023-10-27 14:32:05 UTC] INFO Loading task DAG... 12 nodes discovered.',
              '[2023-10-27 14:32:10 UTC] SUCCESS Resource Discovery complete. Took 00:45s',
              '[2023-10-27 14:32:12 UTC] INFO Executing Network Bootstrap phase...',
              '[2023-10-27 14:32:15 UTC] INFO task-vpc-verify: Checking VPC configuration vpc-bp1qpo...',
              '[2023-10-27 14:32:18 UTC] INFO task-vpc-verify: VSwitch vsw-bp1xyz identified and verified.',
              '[2023-10-27 14:33:24 UTC] SUCCESS Network Bootstrap complete. Took 01:12s',
              '[2023-10-27 14:33:25 UTC] INFO Entering Provisioning phase...',
              `[2026-06-16 19:03:00 UTC] INFO Restarted simulation by operator request.`
            ]
          };
        }
        return w;
      })
    );
  };

  // Convert raw log text color
  const formatLogLine = (line: string) => {
    if (line.includes('SUCCESS') || line.includes('complete.')) {
      return (
        <span className="text-[#c9d1d9]">
          {line.split('SUCCESS')[0]}
          <span className="text-[#3fb950] font-bold">SUCCESS</span>
          {line.split('SUCCESS')[1]}
        </span>
      );
    }
    if (line.includes('DEBUG')) {
      return (
        <span className="text-[#c9d1d9]">
          {line.split('DEBUG')[0]}
          <span className="text-[#d2a8ff]">DEBUG</span>
          {line.split('DEBUG')[1]}
        </span>
      );
    }
    if (line.includes('[FATAL ERROR]') || line.includes('[ABORTED]')) {
      return <span className="text-[#ff7b72] font-semibold">{line}</span>;
    }
    if (line.startsWith('❯')) {
      return <span className="text-[#79c0ff] font-medium">{line}</span>;
    }
    return <span className="text-[#8b949e]">{line}</span>;
  };

  // Downloader
  const handleDownloadLogs = () => {
    const textBlob = new Blob([activeWorkflow.logs.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(textBlob);
    const elem = document.createElement('a');
    elem.href = url;
    elem.download = `cdt_job_log_${activeWorkflow.id}.log`;
    document.body.appendChild(elem);
    elem.click();
    document.body.removeChild(elem);
  };

  return (
    <div className="font-sans flex flex-col gap-6">
      {/* Tab Header bar selection toggle if multiple template logs */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-3">
          <Layers className="w-5 h-5 text-primary" />
          <div>
            <h1 className="text-xl font-bold font-space text-primary-ink">自动化工作流中心 (CDT Workflows)</h1>
            <p className="text-xs text-secondary-ink mt-1">
              审查任务有向无环图 (Task DAG)，追踪各 Provider 任务的进度并捕获详细日志。
            </p>
          </div>
        </div>

        {/* select Active Workflow Template */}
        <div className="flex gap-2 text-xs">
          {workflows.map((item) => (
            <button
              key={item.id}
              onClick={() => setSelectedWorkflowId(item.id)}
              className={`px-3 py-1.5 border rounded cursor-pointer transition-all ${
                selectedWorkflowId === item.id
                  ? 'border-primary bg-emphasis-layer text-primary font-semibold'
                  : 'border-hairline-divider bg-white text-on-surface-variant hover:bg-section-layer'
              }`}
            >
              模板: {item.name.split(' - ')[0]} ({item.id})
            </button>
          ))}
        </div>
      </div>

      {/* Main Single-Run Workflow Detail layout */}
      <div className="flex flex-col gap- grid-cols-1 gap-6">
        {/* Core Task Top summary panel */}
        <section className="bg-surface-white border border-hairline-divider rounded-lg p-5 shadow-sm">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-hairline-divider/40 pb-4 mb-4">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-primary-ink font-space">{activeWorkflow.name}</h2>
                <span className="bg-emphasis-layer border border-primary-fixed text-secondary font-mono px-2 py-0.5 rounded text-[10px] font-bold">
                  {activeWorkflow.id}
                </span>
              </div>
              <p className="text-xs text-secondary-ink mt-1 flex items-center gap-2">
                <span>宿域环境: {activeWorkflow.targetRegion}</span>
              </p>
            </div>

            {/* State tag controller */}
            <div className="flex items-center gap-4">
              <span className="text-xs text-secondary-ink flex items-center gap-1.5 bg-workspace-canvas px-3 py-1.5 border rounded-full">
                <span className={`w-2 h-2 rounded-full ${activeWorkflow.status === 'Running' ? 'bg-signal-amber animate-pulse' : activeWorkflow.status === 'Success' ? 'bg-healthy-green' : 'bg-recovery-red'}`} />
                <span>状态: {activeWorkflow.status === 'Running' ? '正在执行' : activeWorkflow.status === 'Success' ? '已运行成功' : '部署终止'}</span>
                {activeWorkflow.status === 'Running' && (
                  <span className="font-mono text-primary font-bold pl-1">时长: {activeWorkflow.duration}</span>
                )}
              </span>

              <div className="flex gap-2">
                {activeWorkflow.status === 'Running' ? (
                  <>
                    <button
                      onClick={handleAdvanceManually}
                      className="px-3 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary text-xs font-semibold rounded cursor-pointer transition-colors flex items-center gap-1 shadow-xs"
                      title="手动跳步进行演示"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>强进单步 (Simulate)</span>
                    </button>
                    <button
                      onClick={() => handleCancelWorkflow(activeWorkflow.id)}
                      className="px-3 py-1.5 border border-[#FFCDD2] text-recovery-red hover:bg-[#FFEBEE] text-xs font-semibold rounded cursor-pointer transition-all active:scale-95 shadow-2xs"
                    >
                      中止部署 flow
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => handleRestartWorkflowDemo(activeWorkflow.id)}
                    className="px-4 py-1.5 bg-primary text-white text-xs font-semibold rounded cursor-pointer hover:bg-primary-container transition-colors shadow-sm"
                  >
                    重新模拟执行 Demo
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Stepper progress pipeline tracker */}
          <div className="mt-6 relative py-2 select-none">
            {/* Background absolute line path */}
            <div className="absolute top-5 left-0 w-full h-[2.5px] bg-[#EEF2F6] -z-10"></div>
            {/* Dynamic Fill color bar (Resource Discovery to active) */}
            <div 
              className="absolute top-5 left-0 h-[2.5px] bg-primary -z-10 transition-all duration-1000" 
              style={{
                width: 
                  activeWorkflow.status === 'Success' ? '100%' :
                  activeWorkflow.status === 'Failed' ? `${activeWorkflow.activeStepIndex * 25}%` :
                  activeWorkflow.activeStepIndex === 0 ? '12.5%' :
                  activeWorkflow.activeStepIndex === 1 ? '37.5%' :
                  activeWorkflow.activeStepIndex === 2 ? '62.5%' : '87.5%'
              }}
            />

            <div className="flex justify-between w-full font-sans text-xs">
              {/* Step 1: Resource Discovery */}
              <div className="flex flex-col items-center w-1/4">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center border-2 mb-2 shadow-[0_0_0_4px_white] z-10 font-bold font-mono transition-colors duration-500 ${
                  activeWorkflow.activeStepIndex > 0 || activeWorkflow.status === 'Success'
                    ? 'bg-primary text-white border-primary'
                    : 'bg-white text-primary border-primary'
                }`}>
                  {activeWorkflow.activeStepIndex > 0 || activeWorkflow.status === 'Success' ? <Check className="w-3.5 h-3.5" /> : '1'}
                </div>
                <span className="text-[10px] uppercase font-bold text-primary-ink text-center">资源拓扑发现</span>
                <span className="font-mono text-[9px] text-[#245eaa] mt-0.5">00:45s</span>
              </div>

              {/* Step 2: Network Bootstrap */}
              <div className="flex flex-col items-center w-1/4">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center border-2 mb-2 shadow-[0_0_0_4px_white] z-10 font-bold font-mono transition-colors duration-500 ${
                  activeWorkflow.activeStepIndex > 1 || activeWorkflow.status === 'Success'
                    ? 'bg-primary text-white border-primary'
                    : activeWorkflow.activeStepIndex === 1 ? 'bg-white text-primary border-primary animate-pulse' : 'bg-white text-outline border-hairline-divider'
                }`}>
                  {activeWorkflow.activeStepIndex > 1 || activeWorkflow.status === 'Success' ? <Check className="w-3.5 h-3.5" /> : '2'}
                </div>
                <span className="text-[10px] uppercase font-bold text-primary-ink text-center">网络通道自启</span>
                <span className="font-mono text-[9px] text-[#245eaa] mt-0.5">01:12s</span>
              </div>

              {/* Step 3: Provisioning */}
              <div className="flex flex-col items-center w-1/4">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center border-2 mb-2 shadow-[0_0_0_4px_white] z-10 font-bold font-mono transition-colors duration-500 ${
                  activeWorkflow.status === 'Success' ? 'bg-primary text-white border-primary' :
                  activeWorkflow.activeStepIndex > 2 
                    ? 'bg-primary text-white border-primary'
                    : activeWorkflow.activeStepIndex === 2 && activeWorkflow.status === 'Running'
                    ? 'bg-white text-primary border-primary animate-pulse' : 'bg-white text-outline border-hairline-divider'
                }`}>
                  {activeWorkflow.status === 'Success' || activeWorkflow.activeStepIndex > 2 ? <Check className="w-3.5 h-3.5" /> : '3'}
                </div>
                <span className="text-[10px] uppercase font-bold text-primary-ink text-center">资源置备中</span>
                <span className="font-mono text-[9px] text-[#245eaa] mt-0.5 flex items-center gap-1">
                  {activeWorkflow.activeStepIndex === 2 && activeWorkflow.status === 'Running' ? (
                    <>
                      <Loader2 className="w-2.5 h-2.5 animate-spin" /> In Progress
                    </>
                  ) : activeWorkflow.activeStepIndex > 2 || activeWorkflow.status === 'Success' ? (
                    '已就绪'
                  ) : (
                    '等待中'
                  )}
                </span>
              </div>

              {/* Step 4: Validation */}
              <div className="flex flex-col items-center w-1/4">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center border-2 mb-2 shadow-[0_0_0_4px_white] z-10 font-bold font-mono transition-colors duration-500 ${
                  activeWorkflow.status === 'Success' 
                    ? 'bg-primary text-white border-primary'
                    : activeWorkflow.activeStepIndex === 3 && activeWorkflow.status === 'Running'
                    ? 'bg-white text-primary border-primary animate-pulse' : 'bg-white text-outline border-hairline-divider'
                }`}>
                  {activeWorkflow.status === 'Success' ? <Check className="w-3.5 h-3.5" /> : '4'}
                </div>
                <span className="text-[10px] uppercase font-bold text-primary-ink text-center">验证与交付审计</span>
                <span className="font-mono text-[9px] text-[#245eaa] mt-0.5">
                  {activeWorkflow.status === 'Success' ? '验证通过' : 'Pending'}
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Dynamic bottom layout splitting Provider tasks on Left, Logs terminal on Right */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          {/* Left panel: Task detail indicators (Col-Span 4) */}
          <div className="lg:col-span-4 flex flex-col bg-surface-white border border-hairline-divider rounded-lg overflow-hidden shadow-sm">
            <header className="px-4 py-3 bg-[#EEF2F6] border-b border-hairline-divider flex items-center justify-between">
              <span className="text-xs font-bold text-primary-ink">有向任务清单 (Provider Task DAG)</span>
              <span className={`px-2 py-0.5 rounded text-[10px] border font-bold uppercase font-space ${
                activeWorkflow.status === 'Running' ? 'bg-[#FFF8E1] text-[#F57F17] border-[#FFECB3]' : 'bg-green-50 text-[#1B5E20] border-[#c3e6cb]'
              }`}>
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
                    className={`w-full text-left p-3 border rounded text-xs transition-all relative overflow-hidden group focus:outline-none cursor-pointer ${
                      isActive 
                        ? 'border-primary bg-[#E7EDF4]/40 shadow-sm' 
                        : 'border-[#EAEDF1] hover:bg-section-layer/40'
                    }`}
                  >
                    {isActive && (
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary" />
                    )}

                    <div className="flex justify-between items-start mb-1 select-none">
                      <span className={`font-mono text-xs font-bold ${isActive ? 'text-primary' : 'text-primary-ink'}`}>
                        {task.name}
                      </span>
                      {isTaskDone ? (
                        <CheckCircle2 className="w-4 h-4 text-healthy-green" />
                      ) : isTaskActive ? (
                        <span className="text-[10px] text-signal-amber font-semibold flex items-center gap-1">
                          <RefreshCw className="w-3 h-3 animate-spin" />
                          置备中
                        </span>
                      ) : (
                        <span className="text-[10px] text-outline font-medium">Pending</span>
                      )}
                    </div>

                    <p className="text-[11px] text-[#667085] leading-relaxed line-clamp-2">
                      {task.description}
                    </p>

                    {/* Properties Drawer indicator if in progress */}
                    {task.properties && Object.keys(task.properties).length > 0 && (
                      <div className="mt-3 bg-white p-2.5 border rounded-sm font-mono text-[10px] text-[#424751] flex flex-col gap-1.5 shadow-2xs">
                        {Object.entries(task.properties).map(([k, v]) => (
                          <div key={k} className="flex justify-between">
                            <span className="text-secondary-ink">{k}</span>
                            <span className="font-semibold text-primary">{v}</span>
                          </div>
                        ))}
                        {task.progress !== undefined && (
                          <div className="mt-1 flex flex-col gap-1">
                            <div className="w-full bg-[#FAFBFD] rounded-full h-1 overflow-hidden border">
                              <div className="bg-primary h-full progress-bar duration-300 transition-all" style={{ width: `${task.progress}%` }} />
                            </div>
                            <div className="flex justify-between text-[9px] text-[#8b949e]">
                              <span>云端调度排队</span>
                              <span className="font-bold text-primary">{task.progress}% 已置备</span>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right panel: SSH log terminal client view (Col-Span 8) */}
          <div className="lg:col-span-8 flex flex-col bg-[#0d1117] border border-[#30363d] rounded-lg overflow-hidden shadow-sm">
            <header className="px-4 py-3 bg-[#161b22] border-b border-[#30363d] flex justify-between items-center select-none shrink-0">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-[#8b949e]" />
                <span className="text-xs font-mono text-[#c9d1d9] font-bold">同步编排审计日志 (CDT Job Logs)</span>
              </div>

              <div className="flex items-center gap-4 text-[#8b949e] text-xs">
                <label className="flex items-center gap-1.5 font-mono text-[11px] cursor-pointer hover:text-white transition-colors">
                  <input
                    type="checkbox"
                    checked={autoScroll}
                    onChange={(e) => setAutoScroll(e.target.checked)}
                    className="rounded text-primary bg-[#0d1117] border-[#30363d] focus:ring-0 focus:ring-offset-0 h-3 w-3"
                  />
                  <span>Auto-scroll</span>
                </label>
                <button
                  onClick={handleDownloadLogs}
                  className="p-1 hover:text-white rounded transition-colors cursor-pointer"
                  title="下载系统日志"
                >
                  <Download className="w-4 h-4" />
                </button>
              </div>
            </header>

            {/* Logs render window body */}
            <div className="flex-1 p-5 overflow-y-auto terminal-scroll font-mono text-xs leading-relaxed max-h-[480px] min-h-[400px] h-[400px] bg-[#0d1117] flex flex-col gap-1 select-all select-none text-[#c9d1d9]">
              {activeWorkflow.logs.map((logLine, idx) => (
                <div key={idx} className="transition-all py-0.5">
                  {formatLogLine(logLine)}
                </div>
              ))}
              
              {/* Blinking cursor active simulation */}
              {activeWorkflow.status === 'Running' && (
                <div className="flex items-center gap-2 mt-2 font-semibold">
                  <span className="text-[#c9d1d9]">$ system_operator waiting for next task payload ...</span>
                  <span className="bg-[#c9d1d9] w-1.5 h-3.5 inline-block animate-pulse shrink-0"></span>
                </div>
              )}
              <div ref={terminalEndRef} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
