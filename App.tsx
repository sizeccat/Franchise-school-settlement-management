import React, { useState, useEffect, useMemo } from 'react';
import { 
  LayoutDashboard, 
  Play, 
  RotateCcw, 
  ChevronRight, 
  ChevronLeft, 
  Wallet, 
  Building2, 
  GraduationCap, 
  Landmark, 
  RefreshCw,
  FileText,
  X,
  HelpCircle,
  Eye,
  CheckCircle2,
  AlertCircle,
  Clock,
  Filter,
  ArrowUpRight,
  ShieldCheck,
  History,
  Coins,
  FileSearch,
  Check,
  XCircle,
  ClipboardList,
  CalendarDays,
  Search,
  BookOpen, // Added BookOpen icon
  User,
  Users
} from 'lucide-react';

// --- Core Type Definitions ---

enum EntityType {
  JOINT = '共管账户',
  AFFILIATE = '分校账户',
  STUDENT = '学员账户',
  MAIN = '总部账户'
}

enum ScenarioType {
  PAID_ONLY = 'paid_only',
  PASS = 'pass',
  PROTOCOL_REFUND = 'protocol_refund',
  FULL_REFUND = 'full_refund'
}

enum WithdrawalStatus {
  UNWITHDRAWN = 'unwithdrawn',
  PENDING = 'pending',
  WITHDRAWN = 'withdrawn'
}

interface FinancialState {
  stepIndex: number;
  label: string;
  description: string;
  jointBalance: number;
  affiliateBalance: number;
  studentBalance: number;
  mainBalance: number;
  lastTransaction: {
    from: EntityType | null;
    to: EntityType | null;
    amount: number;
    reason: string;
  } | null;
}

interface SimulationParams {
  orderAmount: number;
  protocolRefundAmount: number; 
  commissionRate: number; 
  scenario: ScenarioType;
}

interface OrderData {
  id: string;
  studentName: string;
  courseName: string;
  amount: number;
  status: ScenarioType;
  date: string;
  settlementTime: string | null;
  withdrawalStatus: WithdrawalStatus;
  withdrawnAmount: number;
  withdrawalTime?: string; // Added field for withdrawal approval time
}

interface WithdrawalRequest {
  id: string;
  requestDate: string;
  totalAmount: number;
  orderIds: string[];
  status: 'pending' | 'approved' | 'rejected';
}

interface WithdrawalRecord {
  id: string;
  approvedTime: string;
  totalAmount: number;
  orderCount: number;
}

// --- Core Business Logic ---

const generateSteps = (p: SimulationParams): FinancialState[] => {
  const steps: FinancialState[] = [];
  
  let joint = 0;
  let affiliate = 0;
  let student = p.orderAmount; 
  let main = 0;

  const addStep = (label: string, desc: string, tx: FinancialState['lastTransaction']) => {
    steps.push({
      stepIndex: steps.length,
      label,
      description: desc,
      jointBalance: joint,
      affiliateBalance: affiliate,
      studentBalance: student,
      mainBalance: main,
      lastTransaction: tx
    });
  };

  addStep("订单生成", "学员下单，准备支付", null);

  student -= p.orderAmount;
  joint += p.orderAmount;
  addStep("学员支付", `学员支付 ${p.orderAmount}元 至共管账户`, {
    from: EntityType.STUDENT,
    to: EntityType.JOINT,
    amount: p.orderAmount,
    reason: "订单支付"
  });

  const firstCommission = p.orderAmount * p.commissionRate;
  joint -= firstCommission;
  main += firstCommission;
  addStep("总部提成结算", `规则触发: 总部自动提取首笔提成 (${p.commissionRate * 100}%) = ${firstCommission}元`, {
    from: EntityType.JOINT,
    to: EntityType.MAIN,
    amount: firstCommission,
    reason: "平台管理费"
  });

  if (p.scenario === ScenarioType.PAID_ONLY) {
    addStep("待结算", "等待考试结果或后续操作", null);
    return steps;
  }

  if (p.scenario === ScenarioType.PASS) {
    addStep("考试通过", "学员考试通过，满足全额结算条件", null);
    
    const remaining = joint;
    joint -= remaining;
    affiliate += remaining;
    addStep("分校最终结算", `分校申请提取共管账户剩余全部资金 ${remaining}元`, {
      from: EntityType.JOINT,
      to: EntityType.AFFILIATE,
      amount: remaining,
      reason: "尾款结算"
    });

  } else {
    const refundAmount = p.scenario === ScenarioType.FULL_REFUND ? p.orderAmount : p.protocolRefundAmount;
    
    addStep("考试未通过", `触发${p.scenario === ScenarioType.FULL_REFUND ? '全额' : '协议'}退费流程`, null);

    joint -= refundAmount;
    student += refundAmount;
    addStep("学员退费", `共管账户原路退回 ${refundAmount}元 给学员`, {
      from: EntityType.JOINT,
      to: EntityType.STUDENT,
      amount: refundAmount,
      reason: "退费支出"
    });

    const clawbackAmount = refundAmount * p.commissionRate;
    main -= clawbackAmount;
    joint += clawbackAmount;
    addStep("总部提成回补", `总部需退回退费部分对应的提成 (${refundAmount} * 10% = ${clawbackAmount}元)`, {
      from: EntityType.MAIN,
      to: EntityType.JOINT,
      amount: clawbackAmount,
      reason: "提成回补"
    });

    const finalWithdraw = joint; 
    if (finalWithdraw > 0) {
      joint -= finalWithdraw;
      affiliate += finalWithdraw;
      addStep("分校最终结算", `分校申请提取当前共管账户剩余资金 ${finalWithdraw}元`, {
        from: EntityType.JOINT,
        to: EntityType.AFFILIATE,
        amount: finalWithdraw,
        reason: "尾款结算"
      });
    } else {
      addStep("结算完毕", "共管账户无剩余资金，无需向分校结算", null);
    }
  }
  
  addStep("订单完成", `本单最终结算状态：总部+${main.toFixed(2)}，分校+${affiliate.toFixed(2)}`, null);

  return steps;
};

const calculateAffiliateBalance = (order: OrderData) => {
  const steps = generateSteps({
    orderAmount: order.amount,
    protocolRefundAmount: 6000, 
    commissionRate: 0.1,
    scenario: order.status
  });
  return steps[steps.length - 1].affiliateBalance;
};

const calculateOrderBalances = (order: OrderData) => {
  const steps = generateSteps({
    orderAmount: order.amount,
    protocolRefundAmount: 6000, 
    commissionRate: 0.1,
    scenario: order.status
  });
  return steps[steps.length - 1];
};


// --- Components ---

const BalanceCard: React.FC<{ title: string, balance: number, icon: React.ElementType, type: EntityType, isActive: boolean, isSource: boolean, isTarget: boolean, variant?: string, transactionAmount?: number }> = ({ title, balance, icon: Icon, type, isActive, isSource, isTarget, variant = "default", transactionAmount = 0 }) => {
    let bgClass = "bg-white border-gray-100";
    let iconBgClass = "bg-gray-100 text-gray-600";

    if (variant === "primary") { bgClass = "bg-blue-50 border-blue-200"; iconBgClass = "bg-blue-200 text-blue-700"; } 
    else if (variant === "dark") { bgClass = "bg-slate-800 border-slate-700 text-white"; iconBgClass = "bg-slate-700 text-slate-200"; } 
    else if (type === EntityType.AFFILIATE) { iconBgClass = "bg-purple-100 text-purple-600"; } 
    else if (type === EntityType.STUDENT) { iconBgClass = "bg-orange-100 text-orange-600"; }

    if (isSource) bgClass = "bg-red-50 border-red-400";
    if (isTarget) bgClass = "bg-green-50 border-green-400";
    if (isSource && variant === 'dark') bgClass = "bg-slate-800 border-red-500 ring-2 ring-red-500/50";
    if (isTarget && variant === 'dark') bgClass = "bg-slate-800 border-green-500 ring-2 ring-green-500/50";

    return (
      <div className={`relative p-3 rounded-xl border-2 transition-all duration-300 ${isActive ? 'scale-105 shadow-md z-10' : 'scale-100 shadow-sm'} ${bgClass}`}>
        <div className="flex items-center justify-between mb-2">
          <div className={`p-1.5 rounded-md ${iconBgClass}`}><Icon size={16} /></div>
          <span className={`text-[10px] font-bold uppercase ${variant === 'dark' ? 'text-slate-400' : 'text-gray-400'}`}>{type}</span>
        </div>
        <div className={`text-xs ${variant === 'dark' ? 'text-slate-300' : 'text-gray-500'}`}>{title}</div>
        <div className={`text-lg font-bold mt-1 ${variant === 'dark' ? 'text-white' : 'text-gray-900'}`}>¥{balance.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</div>
        {(isSource || isTarget) && (
          <div className={`absolute -top-2 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full text-[10px] font-bold shadow-sm animate-bounce ${isSource ? 'bg-red-500 text-white' : 'bg-green-500 text-white'}`}>
            {isSource ? '-' : '+'}{Math.abs(transactionAmount)}
          </div>
        )}
      </div>
    );
};

// --- Documentation Component ---
const SystemGuide: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [activeTab, setActiveTab] = useState<'affiliate' | 'auditor'>('affiliate');

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col relative animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-5 border-b border-gray-200 flex justify-between items-center bg-gray-50 rounded-t-2xl">
          <div className="flex items-center gap-2">
            <div className="bg-indigo-600 p-1.5 rounded text-white"><BookOpen size={20}/></div>
            <h2 className="text-xl font-bold text-gray-900">系统使用操作手册</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors"><X size={20} className="text-gray-500"/></button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-gray-200 px-6 pt-4 gap-6">
           <button 
             onClick={() => setActiveTab('affiliate')}
             className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors ${activeTab === 'affiliate' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
           >
             <User size={18} /> 分校端操作指南
           </button>
           <button 
             onClick={() => setActiveTab('auditor')}
             className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors ${activeTab === 'auditor' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
           >
             <Users size={18} /> 总部审核端操作指南
           </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-8">
          {activeTab === 'affiliate' ? (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2">
              <section>
                <h3 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2"><Wallet className="text-indigo-600" size={20}/> 核心功能概述</h3>
                <p className="text-gray-600 leading-relaxed text-sm">
                  分校端主要用于查看本校区的订单结算情况、资金沉淀以及发起提现申请。系统自动根据考试结果（通过/退费）计算分校应得的分成金额。
                </p>
              </section>

              <section className="bg-indigo-50 p-5 rounded-xl border border-indigo-100">
                <h3 className="text-base font-bold text-indigo-900 mb-4">💰 如何查看我的资金？</h3>
                <ul className="space-y-3 text-sm text-indigo-800">
                  <li className="flex gap-2">
                    <span className="font-bold bg-white px-2 py-0.5 rounded border border-indigo-200 text-indigo-600">累计分校收入</span>
                    <span>历史所有已结算订单中，分校获得的总分成（含已提现和未提现）。</span>
                  </li>
                  <li className="flex gap-2">
                     <span className="font-bold bg-white px-2 py-0.5 rounded border border-indigo-200 text-indigo-600">当前可提现余额</span>
                     <span>已完成结算且尚未申请提现的资金。只有此部分资金可以发起提现。</span>
                  </li>
                  <li className="flex gap-2">
                     <span className="font-bold bg-white px-2 py-0.5 rounded border border-indigo-200 text-indigo-600">审核中金额</span>
                     <span>您已发起申请，正在等待总部财务审核的金额。</span>
                  </li>
                </ul>
              </section>

              <section>
                <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2"><CheckCircle2 className="text-green-600" size={20}/> 提现操作流程</h3>
                <div className="flex flex-col gap-4">
                  <div className="flex gap-4 items-start">
                    <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center font-bold text-gray-500 shrink-0">1</div>
                    <div>
                      <h4 className="font-bold text-gray-900 text-sm">确认可提现金额</h4>
                      <p className="text-sm text-gray-500 mt-1">查看顶部的“当前可提现余额”卡片，若余额大于0，则“申请提现”按钮会高亮显示。</p>
                    </div>
                  </div>
                  <div className="flex gap-4 items-start">
                    <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center font-bold text-gray-500 shrink-0">2</div>
                    <div>
                      <h4 className="font-bold text-gray-900 text-sm">发起申请</h4>
                      <p className="text-sm text-gray-500 mt-1">点击“申请提现”按钮，系统会自动将所有“未提现”状态的订单打包生成一张提现申请单。</p>
                    </div>
                  </div>
                  <div className="flex gap-4 items-start">
                    <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center font-bold text-gray-500 shrink-0">3</div>
                    <div>
                      <h4 className="font-bold text-gray-900 text-sm">等待审核</h4>
                      <p className="text-sm text-gray-500 mt-1">申请提交后，相关订单状态变为“审核中”。您可以在“审核中金额”看板或列表筛选中查看。</p>
                    </div>
                  </div>
                   <div className="flex gap-4 items-start">
                    <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center font-bold text-green-600 shrink-0">4</div>
                    <div>
                      <h4 className="font-bold text-gray-900 text-sm">审核通过与到账</h4>
                      <p className="text-sm text-gray-500 mt-1">总部审核通过后，订单状态变为“已提现”，并显示具体的审核通过时间。资金将通过线下或约定渠道打款。</p>
                    </div>
                  </div>
                </div>
              </section>

               <section>
                <h3 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2"><Search className="text-blue-600" size={20}/> 查询与筛选</h3>
                <p className="text-gray-600 text-sm mb-2">系统支持多维度的订单查询，帮助您快速对账：</p>
                <ul className="list-disc pl-5 space-y-2 text-sm text-gray-600">
                  <li><strong>关键词搜索：</strong>支持课程名称、订单号、学员姓名的模糊搜索。</li>
                  <li><strong>状态筛选：</strong>点击表头的Tab（可提现/审核中/已提现）快速分类。</li>
                  <li><strong>时间筛选：</strong>支持按“结算时间”（系统自动结算日期）和“提现时间”（审核通过日期）进行范围查询。</li>
                </ul>
              </section>
            </div>
          ) : (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2">
               <section>
                <h3 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2"><ShieldCheck className="text-indigo-600" size={20}/> 审核员职责概述</h3>
                <p className="text-gray-600 leading-relaxed text-sm">
                  审核端用户（总部财务）拥有更高的具体数据查看权限，主要职责是审核分校发起的提现申请，并监控整体资金流向。
                </p>
              </section>

              <section className="bg-orange-50 p-5 rounded-xl border border-orange-100">
                <h3 className="text-base font-bold text-orange-900 mb-4">⚡ 待办任务处理</h3>
                <p className="text-sm text-orange-800 mb-3">当分校发起提现后，顶部会出现黄色的“待审核提现申请”任务栏。</p>
                <div className="space-y-3">
                   <div className="bg-white p-3 rounded border border-orange-200 text-sm text-gray-700">
                      <strong>步骤 1：</strong> 点击任务栏右侧的“审核”按钮，打开详情弹窗。
                   </div>
                   <div className="bg-white p-3 rounded border border-orange-200 text-sm text-gray-700">
                      <strong>步骤 2：</strong> 在弹窗中核对申请总额、包含的订单明细以及每个订单的分校应得金额。
                   </div>
                    <div className="bg-white p-3 rounded border border-orange-200 text-sm text-gray-700">
                      <strong>步骤 3：</strong> 
                      <ul className="mt-2 pl-4 list-disc text-gray-500">
                        <li>点击 <span className="text-green-600 font-bold">通过审核</span>：订单变更为“已提现”，系统记录通过时间。</li>
                        <li>点击 <span className="text-red-600 font-bold">驳回申请</span>：订单回退为“未提现”状态，分校需重新发起。</li>
                      </ul>
                   </div>
                   <div className="bg-white p-3 rounded border border-orange-200 text-sm text-gray-700">
                      <strong>批量处理：</strong> 勾选任务列表左侧的复选框，可使用顶部的“批量通过”或“批量驳回”按钮一次性处理多笔申请。
                   </div>
                </div>
              </section>

               <section>
                <h3 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2"><Eye className="text-blue-600" size={20}/> 数据可见性差异</h3>
                <p className="text-gray-600 text-sm mb-3">与分校端相比，审核端可以看到更多敏感数据：</p>
                <table className="min-w-full text-sm border border-gray-200 rounded-lg overflow-hidden">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="px-4 py-2 text-left border-b">数据字段</th>
                      <th className="px-4 py-2 text-center border-b text-gray-500">分校端</th>
                      <th className="px-4 py-2 text-center border-b text-blue-600 font-bold">审核端</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b">
                      <td className="px-4 py-2 font-medium">共管账户余额</td>
                      <td className="px-4 py-2 text-center text-green-600">✔ 可见</td>
                      <td className="px-4 py-2 text-center text-green-600">✔ 可见</td>
                    </tr>
                    <tr className="border-b bg-slate-50">
                      <td className="px-4 py-2 font-medium">总部账户余额</td>
                      <td className="px-4 py-2 text-center text-gray-400">✖ 不可见</td>
                      <td className="px-4 py-2 text-center text-green-600">✔ 可见</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-2 font-medium">分校应收金额</td>
                      <td className="px-4 py-2 text-center text-green-600">✔ 可见</td>
                      <td className="px-4 py-2 text-center text-green-600">✔ 可见</td>
                    </tr>
                  </tbody>
                </table>
              </section>
            </div>
          )}
        </div>
        
        {/* Footer */}
        <div className="p-4 bg-gray-50 border-t border-gray-200 rounded-b-2xl text-center text-xs text-gray-400">
          系统版本 v2.4.0 · 财务数据敏感，请注意账号安全
        </div>
      </div>
    </div>
  );
};

const FinancialSimulator: React.FC<{ initialScenario?: ScenarioType }> = ({ initialScenario = ScenarioType.PROTOCOL_REFUND }) => {
    const [params, setParams] = useState<SimulationParams>({
      orderAmount: 10000,
      protocolRefundAmount: 6000,
      commissionRate: 0.1,
      scenario: initialScenario === ScenarioType.PAID_ONLY ? ScenarioType.PROTOCOL_REFUND : initialScenario 
    });
  
    const [currentStep, setCurrentStep] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [history, setHistory] = useState<FinancialState[]>([]);
  
    useEffect(() => {
      const steps = generateSteps(params);
      setHistory(steps);
      setCurrentStep(0);
      setIsPlaying(false);
    }, [params]);
  
    useEffect(() => {
      let interval: any;
      if (isPlaying && currentStep < history.length - 1) {
        interval = setInterval(() => {
          setCurrentStep(prev => prev + 1);
        }, 1500);
      } else if (currentStep >= history.length - 1) {
        setIsPlaying(false);
      }
      return () => clearInterval(interval);
    }, [isPlaying, currentStep, history.length]);
  
    const currentState = history[currentStep] || {
      jointBalance: 0, affiliateBalance: 0, studentBalance: 0, mainBalance: 0, lastTransaction: null, label: "Loading...", description: ""
    };
  
    return (
      <div className="space-y-6">
        <div className="flex gap-2 bg-slate-100 p-2 rounded-lg justify-center">
          {[ScenarioType.PROTOCOL_REFUND, ScenarioType.PASS, ScenarioType.FULL_REFUND].map(s => (
            <button key={s} onClick={() => setParams({...params, scenario: s})}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${params.scenario === s ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
              {s === ScenarioType.PROTOCOL_REFUND ? '协议退费' : s === ScenarioType.PASS ? '考试通过' : '全额退费'}
            </button>
          ))}
        </div>
  
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="relative bg-slate-50 rounded-xl p-4 min-h-[300px] flex flex-col justify-between border border-slate-200">
             <div className="flex justify-center z-20"><div className="w-48"><BalanceCard title="总部账户" balance={currentState.mainBalance} icon={Landmark} type={EntityType.MAIN} variant="dark" isActive={currentState.lastTransaction?.to === EntityType.MAIN || currentState.lastTransaction?.from === EntityType.MAIN} isSource={currentState.lastTransaction?.from === EntityType.MAIN} isTarget={currentState.lastTransaction?.to === EntityType.MAIN} transactionAmount={currentState.lastTransaction?.amount} /></div></div>
             <div className="flex justify-center z-20"><div className="w-56"><BalanceCard title="共管账户" balance={currentState.jointBalance} icon={Building2} type={EntityType.JOINT} variant="primary" isActive={currentState.lastTransaction?.to === EntityType.JOINT || currentState.lastTransaction?.from === EntityType.JOINT} isSource={currentState.lastTransaction?.from === EntityType.JOINT} isTarget={currentState.lastTransaction?.to === EntityType.JOINT} transactionAmount={currentState.lastTransaction?.amount} /></div></div>
             <div className="flex justify-between gap-2 z-20"><div className="w-40"><BalanceCard title="学员账户" balance={currentState.studentBalance} icon={GraduationCap} type={EntityType.STUDENT} isActive={currentState.lastTransaction?.to === EntityType.STUDENT || currentState.lastTransaction?.from === EntityType.STUDENT} isSource={currentState.lastTransaction?.from === EntityType.STUDENT} isTarget={currentState.lastTransaction?.to === EntityType.STUDENT} transactionAmount={currentState.lastTransaction?.amount} /></div><div className="w-40"><BalanceCard title="分校账户" balance={currentState.affiliateBalance} icon={Wallet} type={EntityType.AFFILIATE} isActive={currentState.lastTransaction?.to === EntityType.AFFILIATE || currentState.lastTransaction?.from === EntityType.AFFILIATE} isSource={currentState.lastTransaction?.from === EntityType.AFFILIATE} isTarget={currentState.lastTransaction?.to === EntityType.AFFILIATE} transactionAmount={currentState.lastTransaction?.amount} /></div></div>
             <svg className="absolute inset-0 w-full h-full pointer-events-none text-slate-300 z-0"><line x1="50%" y1="20%" x2="50%" y2="45%" stroke="currentColor" strokeDasharray="4 4" strokeWidth="2"/><line x1="50%" y1="55%" x2="20%" y2="80%" stroke="currentColor" strokeDasharray="4 4" strokeWidth="2"/><line x1="50%" y1="55%" x2="80%" y2="80%" stroke="currentColor" strokeDasharray="4 4" strokeWidth="2"/></svg>
          </div>
  
          <div className="bg-white rounded-xl border border-gray-200 flex flex-col h-[400px]">
            <div className="p-3 border-b bg-gray-50 flex justify-between items-center rounded-t-xl">
               <span className="font-semibold text-gray-700 text-sm">流转日志</span>
               <div className="flex gap-2">
                 <button onClick={() => {setCurrentStep(Math.max(0, currentStep - 1))}} className="p-1 hover:bg-gray-200 rounded"><ChevronLeft size={16}/></button>
                 <button onClick={() => setIsPlaying(!isPlaying)} className="p-1 hover:bg-gray-200 rounded">{isPlaying ? <span className="text-xs font-bold w-4 inline-block text-center">||</span> : <Play size={16}/>}</button>
                 <button onClick={() => {setCurrentStep(Math.min(history.length - 1, currentStep + 1))}} className="p-1 hover:bg-gray-200 rounded"><ChevronRight size={16}/></button>
               </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {history.slice(0, currentStep + 1).reverse().map((step, idx) => (
                <div key={step.stepIndex} className={`flex gap-3 text-sm animate-in fade-in slide-in-from-left-2`}>
                  <div className="flex flex-col items-center"><div className={`w-2 h-2 rounded-full mt-1.5 ${idx === 0 ? 'bg-blue-600' : 'bg-gray-300'}`} />{idx !== history.slice(0, currentStep + 1).length - 1 && <div className="w-0.5 h-full bg-gray-100 mt-1" />}</div>
                  <div className="pb-2">
                    <div className="flex justify-between items-center w-full gap-4">
                       <p className="font-medium text-gray-900">{step.label}</p>
                       {step.lastTransaction && <span className={`text-xs font-mono px-1.5 py-0.5 rounded ${step.lastTransaction.amount > 0 ? 'bg-green-100 text-green-700' : 'text-gray-500'}`}>{step.lastTransaction.to === EntityType.MAIN ? '+' : ''}{step.lastTransaction.amount}</span>}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">{step.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
};

const OrderDetailDrawer: React.FC<{ order: OrderData | null, onClose: () => void }> = ({ order, onClose }) => {
  if (!order) return null;

  const history = useMemo(() => {
    return generateSteps({
      orderAmount: order.amount,
      protocolRefundAmount: 6000, 
      commissionRate: 0.1,
      scenario: order.status
    });
  }, [order]);
  const finalState = history[history.length - 1];

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm transition-opacity" onClick={onClose} />
      <div className="relative w-full max-w-2xl bg-white shadow-2xl h-full flex flex-col animate-in slide-in-from-right duration-300">
        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
          <div>
            <h2 className="text-xl font-bold text-gray-900">订单详情</h2>
            <p className="text-sm text-gray-500 mt-1">单号: {order.id}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors"><X size={20} className="text-gray-500"/></button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-8">
            <div className="grid grid-cols-2 gap-4 bg-blue-50/50 p-4 rounded-xl border border-blue-100">
            <div><span className="text-xs text-gray-500 block">学员姓名</span><span className="font-medium text-gray-900">{order.studentName}</span></div>
            <div><span className="text-xs text-gray-500 block">购买课程</span><span className="font-medium text-gray-900">{order.courseName}</span></div>
            <div><span className="text-xs text-gray-500 block">订单金额</span><span className="font-medium text-gray-900">¥{order.amount.toLocaleString()}</span></div>
            <div><span className="text-xs text-gray-500 block">结算时间</span><span className="font-medium text-gray-900">{order.settlementTime || '-'}</span></div>
            <div><span className="text-xs text-gray-500 block">提现状态</span><span className="font-medium text-gray-900">{
                order.withdrawalStatus === WithdrawalStatus.WITHDRAWN ? '已提现' :
                order.withdrawalStatus === WithdrawalStatus.PENDING ? '审核中' : '未提现'
            }</span></div>
          </div>
          <div>
            <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-4 flex items-center gap-2">
              <Wallet size={16} className="text-blue-600"/> 资金分配结果
            </h3>
            <div className="grid grid-cols-3 gap-4">
               <div className="bg-slate-800 text-white p-4 rounded-xl">
                 <div className="text-xs text-slate-400 mb-1">总部账户净得</div>
                 <div className="text-2xl font-bold">¥{finalState.mainBalance.toLocaleString()}</div>
               </div>
               <div className="bg-blue-600 text-white p-4 rounded-xl">
                 <div className="text-xs text-blue-200 mb-1">分校账户净得</div>
                 <div className="text-2xl font-bold">¥{finalState.affiliateBalance.toLocaleString()}</div>
               </div>
               <div className="bg-gray-100 text-gray-600 p-4 rounded-xl">
                 <div className="text-xs text-gray-500 mb-1">共管账户沉淀</div>
                 <div className="text-2xl font-bold">¥{finalState.jointBalance.toLocaleString()}</div>
               </div>
            </div>
          </div>
          <div>
            <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-4 flex items-center gap-2">
              <Clock size={16} className="text-blue-600"/> 资金处理流水
            </h3>
            <div className="space-y-6 relative pl-2">
               <div className="absolute left-[11px] top-2 bottom-2 w-0.5 bg-gray-100" />
               {history.map((step, idx) => (
                 <div key={idx} className="relative flex gap-4 group">
                    <div className={`relative z-10 w-6 h-6 rounded-full border-2 flex items-center justify-center bg-white ${idx === history.length - 1 ? 'border-blue-600 text-blue-600' : 'border-gray-300 text-gray-300'}`}>
                      <div className={`w-2 h-2 rounded-full ${idx === history.length - 1 ? 'bg-blue-600' : 'bg-gray-300'}`} />
                    </div>
                    <div className="flex-1 bg-white border border-gray-100 p-4 rounded-lg shadow-sm hover:shadow-md transition-shadow">
                      <div className="flex justify-between items-start mb-1">
                        <span className="font-semibold text-gray-900">{step.label}</span>
                        {step.lastTransaction && (
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${step.lastTransaction.amount > 0 ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                             {step.lastTransaction.amount > 0 ? '+' : '-'}{Math.abs(step.lastTransaction.amount)}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600">{step.description}</p>
                    </div>
                 </div>
               ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const WithdrawalHistoryModal: React.FC<{
  records: WithdrawalRecord[],
  onClose: () => void
}> = ({ records, onClose }) => {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col relative animate-in zoom-in-95 duration-200">
        <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50 rounded-t-2xl">
          <div className="flex items-center gap-2">
            <div className="bg-green-600 p-1.5 rounded text-white"><History size={18}/></div>
            <h2 className="text-lg font-bold text-gray-900">提现记录档案</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full"><X size={20} className="text-gray-500"/></button>
        </div>
        <div className="flex-1 overflow-y-auto p-0">
          {records.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-gray-400">
              <ClipboardList size={48} className="mb-2 opacity-50"/>
              <p>暂无提现成功的记录</p>
            </div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-6 py-3 text-left font-medium text-gray-500">提现单号</th>
                  <th className="px-6 py-3 text-left font-medium text-gray-500">通过时间</th>
                  <th className="px-6 py-3 text-left font-medium text-gray-500">笔数</th>
                  <th className="px-6 py-3 text-right font-medium text-gray-500">实发金额</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {records.map(r => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 font-mono text-gray-600">{r.id}</td>
                    <td className="px-6 py-4 text-gray-900">{r.approvedTime}</td>
                    <td className="px-6 py-4 text-gray-900">{r.orderCount}笔</td>
                    <td className="px-6 py-4 text-right font-bold text-green-600">¥{r.totalAmount.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

const AuditModal: React.FC<{ 
    request: WithdrawalRequest, 
    orders: OrderData[], 
    onClose: () => void,
    onApprove: (id: string, amount: number, count: number) => void,
    onReject: (id: string) => void
}> = ({ request, orders, onClose, onApprove, onReject }) => {
    const relevantOrders = orders.filter(o => request.orderIds.includes(o.id));

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl flex flex-col relative animate-in zoom-in-95 duration-200">
                <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50 rounded-t-2xl">
                    <h2 className="text-lg font-bold text-gray-900">提现审核详情</h2>
                    <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full"><X size={20} className="text-gray-500"/></button>
                </div>
                <div className="p-6">
                    <div className="flex justify-between items-center mb-6">
                        <div>
                            <div className="text-sm text-gray-500">申请单号</div>
                            <div className="font-mono font-medium">{request.id}</div>
                        </div>
                        <div className="text-right">
                            <div className="text-sm text-gray-500">申请总额</div>
                            <div className="text-2xl font-bold text-blue-600">¥{request.totalAmount.toLocaleString()}</div>
                        </div>
                    </div>
                    
                    <div className="bg-slate-50 border border-slate-200 rounded-lg overflow-hidden mb-6 max-h-[300px] overflow-y-auto">
                        <table className="min-w-full divide-y divide-gray-200 text-sm">
                            <thead className="bg-slate-100">
                                <tr>
                                    <th className="px-4 py-2 text-left font-medium text-gray-500">关联订单</th>
                                    <th className="px-4 py-2 text-left font-medium text-gray-500">学员</th>
                                    <th className="px-4 py-2 text-right font-medium text-gray-500">提现金额</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 bg-white">
                                {relevantOrders.map(order => (
                                    <tr key={order.id}>
                                        <td className="px-4 py-2">{order.id}</td>
                                        <td className="px-4 py-2">{order.studentName}</td>
                                        <td className="px-4 py-2 text-right font-mono">¥{calculateAffiliateBalance(order).toLocaleString()}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div className="flex gap-4 justify-end">
                        <button 
                            onClick={() => onReject(request.id)}
                            className="px-4 py-2 border border-red-200 text-red-600 rounded-lg hover:bg-red-50 flex items-center gap-2"
                        >
                            <XCircle size={16} /> 驳回申请
                        </button>
                        <button 
                            onClick={() => onApprove(request.id, request.totalAmount, relevantOrders.length)}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 shadow-sm"
                        >
                            <CheckCircle2 size={16} /> 通过审核
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

const App: React.FC = () => {
  const [showExplanation, setShowExplanation] = useState(false);
  const [showGuide, setShowGuide] = useState(false); // State for the new guide modal
  const [showWithdrawalHistory, setShowWithdrawalHistory] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<OrderData | null>(null);
  const [auditRequest, setAuditRequest] = useState<WithdrawalRequest | null>(null);
  const [activeTab, setActiveTab] = useState<'all' | WithdrawalStatus>('all');
  const [isAuditorMode, setIsAuditorMode] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [settlementDateRange, setSettlementDateRange] = useState({ start: '', end: '' });
  const [withdrawalDateRange, setWithdrawalDateRange] = useState({ start: '', end: '' });
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 5;

  // New state for batch selection
  const [selectedRequestIds, setSelectedRequestIds] = useState<string[]>([]);

  const [orders, setOrders] = useState<OrderData[]>([
    { id: 'ORD-2403-001', studentName: '张三', courseName: '金榜题名长线班', amount: 10000, status: ScenarioType.PASS, date: '2024-03-01 10:23', settlementTime: '2024-03-08 10:00', withdrawalStatus: WithdrawalStatus.UNWITHDRAWN, withdrawnAmount: 0 },
    { id: 'ORD-2403-005', studentName: '李四', courseName: '遴选笔试微课vip特享', amount: 10000, status: ScenarioType.PROTOCOL_REFUND, date: '2024-03-02 14:15', settlementTime: '2024-03-09 11:30', withdrawalStatus: WithdrawalStatus.WITHDRAWN, withdrawnAmount: 4000, withdrawalTime: '2024-03-09 16:20' },
    { id: 'ORD-2403-012', studentName: '王五', courseName: '宁德市直遴选面试大班线下面授', amount: 10000, status: ScenarioType.FULL_REFUND, date: '2024-03-03 09:30', settlementTime: null, withdrawalStatus: WithdrawalStatus.UNWITHDRAWN, withdrawnAmount: 0 },
    { id: 'ORD-2403-021', studentName: '孙七', courseName: '省考面试冲刺集训营', amount: 8000, status: ScenarioType.PASS, date: '2024-03-05 11:20', settlementTime: '2024-03-12 14:00', withdrawalStatus: WithdrawalStatus.PENDING, withdrawnAmount: 0 },
    { id: 'ORD-2403-025', studentName: '周八', courseName: '事业单位统考笔试全程班', amount: 10000, status: ScenarioType.PASS, date: '2024-03-06 09:10', settlementTime: '2024-03-13 09:00', withdrawalStatus: WithdrawalStatus.UNWITHDRAWN, withdrawnAmount: 0 },
    { id: 'ORD-2404-001', studentName: '赵九', courseName: '国考申论专项提升', amount: 5000, status: ScenarioType.PASS, date: '2024-04-01 10:00', settlementTime: '2024-04-08 10:00', withdrawalStatus: WithdrawalStatus.UNWITHDRAWN, withdrawnAmount: 0 },
    { id: 'ORD-2404-002', studentName: '钱十', courseName: '公安系统面试特训', amount: 12000, status: ScenarioType.PASS, date: '2024-04-02 11:00', settlementTime: '2024-04-09 11:00', withdrawalStatus: WithdrawalStatus.UNWITHDRAWN, withdrawnAmount: 0 },
    { id: 'ORD-2404-003', studentName: '吴十一', courseName: '教师招聘笔试协议班', amount: 15000, status: ScenarioType.PROTOCOL_REFUND, date: '2024-04-03 12:00', settlementTime: '2024-04-10 12:00', withdrawalStatus: WithdrawalStatus.PENDING, withdrawnAmount: 0 },
  ]);

  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([
      { id: 'WDR-20240315-01', requestDate: '2024-03-15', totalAmount: 7200, orderIds: ['ORD-2403-021'], status: 'pending' },
      { id: 'WDR-20240410-01', requestDate: '2024-04-10', totalAmount: 9000, orderIds: ['ORD-2404-003'], status: 'pending' },
  ]);

  const [withdrawalHistory, setWithdrawalHistory] = useState<WithdrawalRecord[]>([
      { id: 'WDR-20240309-99', approvedTime: '2024-03-09 16:20', totalAmount: 4000, orderCount: 1 }
  ]);
  
  const filteredOrders = useMemo(() => {
    return orders
      .filter(o => { // Search filter
        const term = searchTerm.toLowerCase();
        if (!term) return true;
        return o.courseName.toLowerCase().includes(term) ||
               o.id.toLowerCase().includes(term) ||
               o.studentName.toLowerCase().includes(term);
      })
      .filter(o => { // Tab filter
        if (activeTab === 'all') return true;
        return o.withdrawalStatus === activeTab;
      })
      .filter(o => { // Settlement date filter
        if (!settlementDateRange.start && !settlementDateRange.end) return true;
        if (!o.settlementTime) return false;
        // Compare only date part, ignoring time
        const settlementDate = new Date(o.settlementTime.split(' ')[0]);
        const start = settlementDateRange.start ? new Date(settlementDateRange.start) : null;
        const end = settlementDateRange.end ? new Date(settlementDateRange.end) : null;
        if (start && settlementDate < start) return false;
        if (end && settlementDate > end) return false;
        return true;
      })
      .filter(o => { // Withdrawal date filter
        if (!withdrawalDateRange.start && !withdrawalDateRange.end) return true;
        if (!o.withdrawalTime) return false;
        const withdrawalDate = new Date(o.withdrawalTime.split(' ')[0]);
        const start = withdrawalDateRange.start ? new Date(withdrawalDateRange.start) : null;
        const end = withdrawalDateRange.end ? new Date(withdrawalDateRange.end) : null;
        if (start && withdrawalDate < start) return false;
        if (end && withdrawalDate > end) return false;
        return true;
      });
  }, [orders, activeTab, searchTerm, settlementDateRange, withdrawalDateRange]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, activeTab, settlementDateRange, withdrawalDateRange]);

  const paginatedOrders = useMemo(() => {
      const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
      return filteredOrders.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredOrders, currentPage]);

  const totalPages = Math.ceil(filteredOrders.length / ITEMS_PER_PAGE);

  const summary = useMemo(() => {
    let totalSettled = 0;
    let availableToWithdraw = 0;
    let pendingAudit = 0;
    let totalWithdrawn = 0;

    filteredOrders.forEach(order => {
        const settled = calculateAffiliateBalance(order);
        if (order.status !== ScenarioType.PAID_ONLY) {
            totalSettled += settled;
        }
        
        if (order.withdrawalStatus === WithdrawalStatus.UNWITHDRAWN && order.status !== ScenarioType.PAID_ONLY) {
            availableToWithdraw += settled;
        } else if (order.withdrawalStatus === WithdrawalStatus.PENDING) {
            pendingAudit += settled;
        } else if (order.withdrawalStatus === WithdrawalStatus.WITHDRAWN) {
            totalWithdrawn += order.withdrawnAmount;
        }
    });

    return { totalSettled, availableToWithdraw, pendingAudit, totalWithdrawn };
  }, [filteredOrders]);

  const pendingWithdrawals = useMemo(() => withdrawals.filter(w => w.status === 'pending'), [withdrawals]);

  const handleApplyWithdrawal = () => {
    const withdrawableOrders = orders.filter(o => o.withdrawalStatus === WithdrawalStatus.UNWITHDRAWN && calculateAffiliateBalance(o) > 0);
    
    if (withdrawableOrders.length === 0) {
        alert("当前没有可提现的订单");
        return;
    }

    const totalAmount = withdrawableOrders.reduce((sum, o) => sum + calculateAffiliateBalance(o), 0);
    const newRequest: WithdrawalRequest = {
        id: `WDR-${new Date().toISOString().slice(0,10).replace(/-/g,'')}-${Math.floor(Math.random()*1000)}`,
        requestDate: new Date().toISOString().split('T')[0],
        totalAmount,
        orderIds: withdrawableOrders.map(o => o.id),
        status: 'pending'
    };

    setWithdrawals([...withdrawals, newRequest]);
    setOrders(orders.map(o => withdrawableOrders.find(wo => wo.id === o.id) ? { ...o, withdrawalStatus: WithdrawalStatus.PENDING } : o));
    alert(`成功申请提现 ¥${totalAmount}，包含 ${withdrawableOrders.length} 笔订单`);
  };

  const handleApprove = (id: string, amount: number, count: number) => {
    const request = withdrawals.find(w => w.id === id);
    if (!request) return;
    
    const approvedTime = new Date().toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).replace(/\//g, '-');

    setWithdrawals(withdrawals.map(w => w.id === id ? { ...w, status: 'approved' } : w));
    setOrders(orders.map(o => {
        if (request.orderIds.includes(o.id)) {
            return { 
                ...o, 
                withdrawalStatus: WithdrawalStatus.WITHDRAWN, 
                withdrawnAmount: calculateAffiliateBalance(o),
                withdrawalTime: approvedTime
            };
        }
        return o;
    }));

    const newRecord: WithdrawalRecord = {
      id: request.id,
      approvedTime: approvedTime,
      totalAmount: amount,
      orderCount: count
    };
    setWithdrawalHistory(prev => [newRecord, ...prev]);

    setSelectedRequestIds(prev => prev.filter(i => i !== id));
    setAuditRequest(null);
  };

  const handleReject = (id: string) => {
    const request = withdrawals.find(w => w.id === id);
    if (!request) return;

    setWithdrawals(withdrawals.map(w => w.id === id ? { ...w, status: 'rejected' } : w));
    setOrders(orders.map(o => {
        if (request.orderIds.includes(o.id)) {
            return { ...o, withdrawalStatus: WithdrawalStatus.UNWITHDRAWN, withdrawalTime: undefined };
        }
        return o;
    }));
    setSelectedRequestIds(prev => prev.filter(i => i !== id));
    setAuditRequest(null);
  };

  const toggleRequestSelection = (id: string) => {
    setSelectedRequestIds(prev => 
        prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
      if (selectedRequestIds.length === pendingWithdrawals.length) {
          setSelectedRequestIds([]);
      } else {
          setSelectedRequestIds(pendingWithdrawals.map(w => w.id));
      }
  };

  const handleBatchApprove = () => {
    if (selectedRequestIds.length === 0) return;
    
    const approvedTime = new Date().toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).replace(/\//g, '-');
    
    const requestsToApprove = withdrawals.filter(w => selectedRequestIds.includes(w.id));
    const allOrderIdsToApprove = requestsToApprove.flatMap(r => r.orderIds);

    setWithdrawals(prev => prev.map(w => selectedRequestIds.includes(w.id) ? { ...w, status: 'approved' } : w));
    setOrders(prev => prev.map(o => {
        if (allOrderIdsToApprove.includes(o.id)) {
            return { 
                ...o, 
                withdrawalStatus: WithdrawalStatus.WITHDRAWN, 
                withdrawnAmount: calculateAffiliateBalance(o),
                withdrawalTime: approvedTime
            };
        }
        return o;
    }));

    const newRecords: WithdrawalRecord[] = requestsToApprove.map(req => ({
      id: req.id,
      approvedTime: approvedTime,
      totalAmount: req.totalAmount,
      orderCount: req.orderIds.length
    }));
    setWithdrawalHistory(prev => [...newRecords, ...prev]);

    setSelectedRequestIds([]);
    alert(`已批量通过 ${requestsToApprove.length} 笔申请`);
  };

  const handleBatchReject = () => {
    if (selectedRequestIds.length === 0) return;

    const requestsToReject = withdrawals.filter(w => selectedRequestIds.includes(w.id));
    const allOrderIdsToReject = requestsToReject.flatMap(r => r.orderIds);

    setWithdrawals(prev => prev.map(w => selectedRequestIds.includes(w.id) ? { ...w, status: 'rejected' } : w));
    setOrders(prev => prev.map(o => {
        if (allOrderIdsToReject.includes(o.id)) {
            return { ...o, withdrawalStatus: WithdrawalStatus.UNWITHDRAWN, withdrawalTime: undefined };
        }
        return o;
    }));
    
    setSelectedRequestIds([]);
    alert(`已批量驳回 ${requestsToReject.length} 笔申请`);
  };

  const handleResetFilters = () => {
    setSearchTerm('');
    setSettlementDateRange({ start: '', end: '' });
    setWithdrawalDateRange({ start: '', end: '' });
    setActiveTab('all');
  }

  const getStatusBadge = (status: ScenarioType) => {
    switch (status) {
      case ScenarioType.PASS: return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">已结算</span>;
      case ScenarioType.PROTOCOL_REFUND: return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-800">协议退</span>;
      case ScenarioType.FULL_REFUND: return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">全额退</span>;
      default: return <span className="bg-gray-100 text-gray-800 px-2 py-0.5 rounded text-xs">未知</span>;
    }
  };

  const getWithdrawalBadge = (order: OrderData) => {
      switch (order.withdrawalStatus) {
          case WithdrawalStatus.UNWITHDRAWN: return <span className="text-gray-500 flex items-center gap-1"><Coins size={12}/> 未提现</span>;
          case WithdrawalStatus.PENDING: return <span className="text-orange-600 flex items-center gap-1"><History size={12}/> 审核中</span>;
          case WithdrawalStatus.WITHDRAWN: return (
            <div>
              <span className="text-green-600 flex items-center gap-1"><CheckCircle2 size={12}/> 已提现</span>
              {order.withdrawalTime && (
                 <div className="text-xs text-gray-400 flex items-center gap-1 mt-1">
                    <CalendarDays size={10}/> {new Date(order.withdrawalTime).toLocaleDateString()}
                 </div>
              )}
            </div>
          );
      }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-gray-900 font-sans">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center gap-3">
              <div className="bg-blue-600 p-2 rounded-lg text-white">
                <FileText size={20} />
              </div>
              <div>
                <h1 className="text-lg font-bold text-gray-900 leading-none">加盟校财务结算管理</h1>
                <span className="text-xs text-gray-500">分校端 / 财务审核端</span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 bg-gray-100 p-1 rounded-lg mr-4">
                  <span className={`text-xs px-2 py-1 rounded cursor-pointer transition-colors ${!isAuditorMode ? 'bg-white shadow text-gray-900' : 'text-gray-500'}`} onClick={() => setIsAuditorMode(false)}>分校视角</span>
                  <span className={`text-xs px-2 py-1 rounded cursor-pointer transition-colors ${isAuditorMode ? 'bg-blue-600 shadow text-white' : 'text-gray-500'}`} onClick={() => setIsAuditorMode(true)}>审核视角</span>
              </div>
              <button onClick={() => setShowWithdrawalHistory(true)} className="flex items-center gap-2 text-sm font-medium text-green-600 bg-green-50 px-3 py-2 rounded-lg hover:bg-green-100 transition-colors">
                <ClipboardList size={16} /> 提现记录
              </button>
              <button onClick={() => setShowExplanation(true)} className="flex items-center gap-2 text-sm font-medium text-blue-600 bg-blue-50 px-3 py-2 rounded-lg hover:bg-blue-100 transition-colors">
                <HelpCircle size={16} /> 资金流转说明
              </button>
              {/* New Documentation Button */}
              <button onClick={() => setShowGuide(true)} className="flex items-center gap-2 text-sm font-medium text-indigo-600 bg-indigo-50 px-3 py-2 rounded-lg hover:bg-indigo-100 transition-colors">
                <BookOpen size={16} /> 系统使用手册
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                <div className="text-xs text-gray-500 mb-1 flex items-center gap-1"><Wallet size={14}/> 累计分校收入</div>
                <div className="text-2xl font-bold text-gray-900">¥{summary.totalSettled.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</div>
            </div>
            <div className="bg-white p-5 rounded-xl border border-blue-200 bg-blue-50/30 shadow-sm relative overflow-hidden">
                <div className="text-xs text-blue-600 mb-1 flex items-center gap-1"><Coins size={14}/> 当前可提现余额</div>
                <div className="text-2xl font-bold text-blue-700">¥{summary.availableToWithdraw.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</div>
                {!isAuditorMode && (
                    <button 
                        onClick={handleApplyWithdrawal}
                        disabled={summary.availableToWithdraw <= 0}
                        className="absolute right-4 top-1/2 -translate-y-1/2 bg-blue-600 text-white text-xs px-3 py-1.5 rounded-lg shadow hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        申请提现
                    </button>
                )}
            </div>
            <div className="bg-white p-5 rounded-xl border border-orange-200 bg-orange-50/30 shadow-sm">
                <div className="text-xs text-orange-600 mb-1 flex items-center gap-1"><History size={14}/> 审核中金额</div>
                <div className="text-2xl font-bold text-orange-700">¥{summary.pendingAudit.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</div>
            </div>
            <div className="bg-white p-5 rounded-xl border border-green-200 bg-green-50/30 shadow-sm">
                <div className="text-xs text-green-600 mb-1 flex items-center gap-1"><CheckCircle2 size={14}/> 已提现总额</div>
                <div className="text-2xl font-bold text-green-700">¥{summary.totalWithdrawn.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</div>
            </div>
        </div>

        {isAuditorMode && pendingWithdrawals.length > 0 && (
            <div className="mb-8 bg-white border border-orange-200 rounded-xl shadow-sm overflow-hidden animate-in fade-in slide-in-from-top-4">
                <div className="px-6 py-3 bg-orange-50 border-b border-orange-100 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                         <input 
                            type="checkbox" 
                            checked={pendingWithdrawals.length > 0 && selectedRequestIds.length === pendingWithdrawals.length}
                            onChange={toggleSelectAll}
                            className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                         />
                         <h3 className="font-bold text-orange-800 flex items-center gap-2"><ShieldCheck size={18}/> 待审核提现申请 ({pendingWithdrawals.length})</h3>
                    </div>
                    
                    {selectedRequestIds.length > 0 && (
                        <div className="flex gap-2">
                            <button onClick={handleBatchReject} className="px-3 py-1.5 bg-white border border-red-200 text-red-600 rounded-lg text-xs font-medium hover:bg-red-50">
                                批量驳回 ({selectedRequestIds.length})
                            </button>
                            <button onClick={handleBatchApprove} className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 shadow-sm">
                                批量通过 ({selectedRequestIds.length})
                            </button>
                        </div>
                    )}
                </div>
                <div className="divide-y divide-gray-100">
                    {pendingWithdrawals.map(w => (
                        <div key={w.id} className="px-6 py-4 flex items-center justify-between hover:bg-gray-50">
                            <div className="flex items-center gap-4">
                                <input 
                                    type="checkbox"
                                    checked={selectedRequestIds.includes(w.id)}
                                    onChange={() => toggleRequestSelection(w.id)}
                                    className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                                />
                                <div>
                                    <div className="font-medium text-gray-900">{w.id}</div>
                                    <div className="text-sm text-gray-500 mt-1">申请时间: {w.requestDate} · 包含 {w.orderIds.length} 笔订单</div>
                                </div>
                            </div>
                            <div className="flex items-center gap-6">
                                <div className="text-right">
                                    <div className="text-xs text-gray-500">申请金额</div>
                                    <div className="text-lg font-bold text-blue-600">¥{w.totalAmount.toLocaleString()}</div>
                                </div>
                                <button 
                                    onClick={() => setAuditRequest(w)}
                                    className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 shadow-sm"
                                >
                                    审核
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        )}

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex-1 flex items-center gap-4">
                  <h2 className="font-semibold text-gray-700 flex-shrink-0">订单结算明细</h2>
                  <div className="relative w-full max-w-xs">
                      <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                      <input
                          type="text"
                          placeholder="搜索课程、订单号、学员姓名"
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                      />
                  </div>
              </div>
              
              <div className="flex bg-gray-200 p-1 rounded-lg">
                  {[
                      { key: 'all', label: '全部订单' },
                      { key: WithdrawalStatus.UNWITHDRAWN, label: '可提现' },
                      { key: WithdrawalStatus.PENDING, label: '审核中' },
                      { key: WithdrawalStatus.WITHDRAWN, label: '已提现' }
                  ].map(tab => (
                      <button
                          key={tab.key}
                          onClick={() => setActiveTab(tab.key as any)}
                          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                              activeTab === tab.key ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                          }`}
                      >
                          {tab.label}
                      </button>
                  ))}
              </div>
            </div>
            <div className="flex items-center gap-4 text-sm text-gray-600">
                <div className="flex items-center gap-2">
                    <label htmlFor="settlement-start">结算时间:</label>
                    <input type="date" id="settlement-start" value={settlementDateRange.start} onChange={e => setSettlementDateRange(p => ({...p, start: e.target.value}))} className="px-2 py-1 border border-gray-300 rounded-md text-sm"/>
                    <span>-</span>
                    <input type="date" id="settlement-end" value={settlementDateRange.end} onChange={e => setSettlementDateRange(p => ({...p, end: e.target.value}))} className="px-2 py-1 border border-gray-300 rounded-md text-sm"/>
                </div>
                 <div className="flex items-center gap-2">
                    <label htmlFor="withdrawal-start">提现时间:</label>
                    <input type="date" id="withdrawal-start" value={withdrawalDateRange.start} onChange={e => setWithdrawalDateRange(p => ({...p, start: e.target.value}))} className="px-2 py-1 border border-gray-300 rounded-md text-sm"/>
                    <span>-</span>
                    <input type="date" id="withdrawal-end" value={withdrawalDateRange.end} onChange={e => setWithdrawalDateRange(p => ({...p, end: e.target.value}))} className="px-2 py-1 border border-gray-300 rounded-md text-sm"/>
                </div>
                <button onClick={handleResetFilters} className="text-blue-600 text-xs font-medium hover:underline">重置筛选</button>
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">订单信息</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">结算信息</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-100">共管账户余额</th>
                  {isAuditorMode && (
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-slate-100">总部账户余额</th>
                  )}
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-purple-50/50">分校应收</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-blue-50/50">提现状态</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-green-50/50">已提现金额</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {paginatedOrders.map((order) => {
                  const fullBalance = calculateOrderBalances(order);
                  return (
                    <tr key={order.id} className="hover:bg-gray-50 transition-colors cursor-pointer" onClick={() => setSelectedOrder(order)}>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-gray-900 line-clamp-1" title={order.courseName}>{order.courseName}</span>
                          <span className="text-xs text-gray-500">{order.id} | {order.studentName}</span>
                          <span className="text-xs text-gray-400 mt-1">订单额: ¥{order.amount.toLocaleString()}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-1">
                            {getStatusBadge(order.status)}
                            <div className="text-xs text-gray-400 flex items-center gap-1 mt-1">
                                <Clock size={10}/> {order.settlementTime ? order.settlementTime.split(' ')[0] : '待结算'}
                            </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 bg-gray-50">
                        <div className="text-sm font-medium text-gray-600">¥{fullBalance.jointBalance.toLocaleString()}</div>
                      </td>
                      {isAuditorMode && (
                        <td className="px-6 py-4 bg-slate-50">
                          <div className="text-sm font-medium text-slate-800">¥{fullBalance.mainBalance.toLocaleString()}</div>
                        </td>
                      )}
                      <td className="px-6 py-4 bg-purple-50/30">
                         <div className="text-sm font-bold text-purple-700">¥{fullBalance.affiliateBalance.toLocaleString()}</div>
                      </td>
                      <td className="px-6 py-4 bg-blue-50/30">
                         <div className="text-sm">
                             {getWithdrawalBadge(order)}
                         </div>
                      </td>
                      <td className="px-6 py-4 bg-green-50/30">
                        <div className="text-sm font-bold text-green-700">¥{order.withdrawnAmount.toLocaleString()}</div>
                      </td>
                      <td className="px-6 py-4 text-right text-sm font-medium">
                        <button 
                          className="text-blue-600 hover:text-blue-900 flex items-center gap-1 ml-auto"
                          onClick={(e) => { e.stopPropagation(); setSelectedOrder(order); }}
                        >
                          <Eye size={16}/> 详情
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {filteredOrders.length === 0 ? (
             <div className="text-center py-12 text-gray-500">
                <FileSearch size={40} className="mx-auto mb-2 opacity-50"/>
                <p>没有找到匹配的订单</p>
                <p className="text-xs mt-1">请尝试调整您的筛选条件</p>
             </div>
          ) : (
            <div className="px-6 py-3 border-t border-gray-200 flex items-center justify-between text-sm">
              <span className="text-gray-600">
                共 <strong>{filteredOrders.length}</strong> 条记录，第 <strong>{currentPage}</strong> / <strong>{totalPages}</strong> 页
              </span>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1 border border-gray-300 rounded-md hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  上一页
                </button>
                 <button 
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1 border border-gray-300 rounded-md hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  下一页
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      <footer className="max-w-7xl mx-auto px-4 text-center text-sm text-gray-400 py-6">
        &copy; 2024 Affiliate School Financial System. All rights reserved.
      </footer>

      {selectedOrder && <OrderDetailDrawer order={selectedOrder} onClose={() => setSelectedOrder(null)} />}
      
      {auditRequest && (
          <AuditModal 
            request={auditRequest} 
            orders={orders} 
            onClose={() => setAuditRequest(null)}
            onApprove={handleApprove}
            onReject={handleReject}
          />
      )}

      {showExplanation && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowExplanation(false)} />
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col relative animate-in zoom-in-95 duration-200">
            <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
              <div className="flex items-center gap-2">
                <div className="bg-blue-600 p-1.5 rounded text-white"><RefreshCw size={18}/></div>
                <h2 className="text-lg font-bold text-gray-900">资金结算模拟系统</h2>
              </div>
              <button onClick={() => setShowExplanation(false)} className="p-2 hover:bg-gray-200 rounded-full"><X size={20} className="text-gray-500"/></button>
            </div>
            <div className="p-6 overflow-y-auto bg-slate-50">
               <FinancialSimulator />
            </div>
          </div>
        </div>
      )}

      {/* New System Guide Modal */}
      {showGuide && (
        <SystemGuide onClose={() => setShowGuide(false)} />
      )}

      {showWithdrawalHistory && (
        <WithdrawalHistoryModal records={withdrawalHistory} onClose={() => setShowWithdrawalHistory(false)} />
      )}
    </div>
  );
};

export default App;