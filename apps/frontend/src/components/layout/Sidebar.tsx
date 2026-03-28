import { useCallback, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  MapPin,
  UserCheck,
  Beef,
  Layers,
  Scale,
  Sprout,
  SprayCan,
  Droplet,
  Droplets,
  Stethoscope,
  Shovel,
  UsersRound,
  ClipboardList,
  Bug,
  FolderTree,
  Wheat,
  Tractor,
  Coffee,
  Map,
  Citrus,
  Baby,
  Milestone,
  Heart,
  HeartHandshake,
  HeartPulse,
  Syringe,
  Flame,
  Users,
  Shield,
  Ruler,
  Package,
  PackageOpen,
  ArrowUpRight,
  Bell,
  ClipboardCheck,
  FileText,
  ArrowRightLeft,
  TrendingDown,
  ShieldPlus,
  FlaskConical,
  Activity,
  BarChart2,
  BarChart3,
  BellRing,
  CalendarClock,
  Zap,
  ScanLine,
  X,
  CupSoda,
  Milk,
  TestTube,
  ShieldAlert,
  Container,
  Salad,
  UtensilsCrossed,
  Cookie,
  Building2,
  Receipt,
  ReceiptText,
  ArrowLeftRight,
  CreditCard,
  CheckSquare,
  Landmark,
  TreePine,
  TrendingUp,
  GitMerge,
  Handshake,
  ShoppingCart,
  Settings2,
  Settings,
  FileSearch,
  PackageCheck,
  Undo2,
  Wallet,
  Columns3,
  Wrench,
  LogOut,
  FileBarChart,
  Leaf,
  UserRound,
  Briefcase,
  Calendar,
  Clock,
  CalendarCheck,
  UserMinus,
  PiggyBank,
  HardHat,
  GraduationCap,
  FileBarChart2,
  FileCode,
  BookOpen,
  GitBranch,
} from 'lucide-react';
import { useOverdueCount } from '@/hooks/usePayables';
import { useCheckAlertCount } from '@/hooks/useCheckAlertCount';
import { useRuralCreditAlertCount } from '@/hooks/useRuralCredit';
import './Sidebar.css';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

interface NavItem {
  to: string;
  icon: React.ElementType;
  label: string;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    title: 'GERAL',
    items: [{ to: '/dashboard', icon: LayoutDashboard, label: 'Início' }],
  },
  {
    title: 'PROPRIEDADE',
    items: [
      { to: '/farms', icon: MapPin, label: 'Fazendas' },
      { to: '/rural-properties', icon: Landmark, label: 'Imóveis rurais' },
      { to: '/registrations', icon: FileText, label: 'Matrículas' },
      { to: '/car-registrations', icon: TreePine, label: 'CAR' },
      { to: '/producers', icon: UserCheck, label: 'Produtores' },
    ],
  },
  {
    title: 'REBANHO',
    items: [
      { to: '/herd-dashboard', icon: BarChart3, label: 'Dashboard rebanho' },
      { to: '/animals', icon: Beef, label: 'Animais' },
      { to: '/lots', icon: Layers, label: 'Lotes' },
      { to: '/weighing-session', icon: Scale, label: 'Pesagem' },
      { to: '/diseases', icon: HeartPulse, label: 'Doenças' },
      { to: '/treatment-protocols', icon: Syringe, label: 'Protocolos tratamento' },
      { to: '/sanitary-protocols', icon: ShieldPlus, label: 'Protocolos sanitários' },
      { to: '/vaccinations', icon: Syringe, label: 'Vacinações' },
      { to: '/dewormings', icon: Droplet, label: 'Vermifugações' },
      { to: '/therapeutic-treatments', icon: Stethoscope, label: 'Tratamentos' },
      { to: '/animal-exams', icon: FlaskConical, label: 'Exames' },
      { to: '/reproductive-releases', icon: Baby, label: 'Liberação reprodutiva' },
      { to: '/bulls', icon: Heart, label: 'Touros e sêmen' },
      { to: '/heat-records', icon: Flame, label: 'Detecção de cio' },
      { to: '/mating-plans', icon: HeartHandshake, label: 'Acasalamento' },
      { to: '/iatf-protocols', icon: CalendarClock, label: 'Protocolos IATF' },
      { to: '/iatf-execution', icon: Zap, label: 'Execução IATF' },
      { to: '/inseminations', icon: Syringe, label: 'Inseminações' },
      { to: '/natural-matings', icon: Beef, label: 'Monta natural' },
      { to: '/pregnancy-diagnosis', icon: ScanLine, label: 'Diagnóstico gestação' },
      { to: '/calving-events', icon: Milestone, label: 'Partos e crias' },
      { to: '/weaning', icon: CupSoda, label: 'Desmama' },
      { to: '/sanitary-dashboard', icon: Activity, label: 'Dashboard sanitário' },
      { to: '/animal-exits', icon: LogOut, label: 'Saídas de animais' },
    ],
  },
  {
    title: 'LEITE',
    items: [
      { to: '/milking-records', icon: Milk, label: 'Ordenha' },
      { to: '/milk-analysis', icon: TestTube, label: 'Análise de leite' },
      { to: '/mastitis', icon: ShieldAlert, label: 'Mastite' },
      { to: '/milk-tanks', icon: Container, label: 'Tanque e entregas' },
      { to: '/lactations', icon: Droplets, label: 'Lactação' },
      { to: '/milk-dashboard', icon: BarChart3, label: 'Dashboard leite' },
    ],
  },
  {
    title: 'NUTRIÇÃO',
    items: [
      { to: '/feed-ingredients', icon: Salad, label: 'Ingredientes' },
      { to: '/diets', icon: UtensilsCrossed, label: 'Dietas' },
      { to: '/feeding-records', icon: Cookie, label: 'Trato/Fornecimento' },
    ],
  },
  {
    title: 'LAVOURA',
    items: [
      { to: '/planting', icon: Wheat, label: 'Plantio' },
      { to: '/soil-prep', icon: Tractor, label: 'Preparo de solo' },
      { to: '/cultivars', icon: Sprout, label: 'Cultivares' },
      { to: '/pesticide-applications', icon: SprayCan, label: 'Defensivos' },
      { to: '/pesticide-prescriptions', icon: FileText, label: 'Receituários' },
      { to: '/fertilizer-applications', icon: Droplet, label: 'Adubação' },
      { to: '/cultural-operations', icon: Shovel, label: 'Tratos culturais' },
      { to: '/field-teams', icon: UsersRound, label: 'Equipes de campo' },
      { to: '/team-operations', icon: ClipboardList, label: 'Operações em bloco' },
      { to: '/coffee-harvests', icon: Coffee, label: 'Colheita de café' },
      { to: '/productivity-map', icon: Map, label: 'Mapa produtividade' },
      { to: '/orange-harvests', icon: Citrus, label: 'Colheita de laranja' },
      { to: '/pests', icon: Bug, label: 'Pragas e doenças' },
      { to: '/operation-types', icon: FolderTree, label: 'Tipos de operação' },
    ],
  },
  {
    title: 'ESTOQUE',
    items: [
      { to: '/stock-entries', icon: PackageOpen, label: 'Entradas' },
      { to: '/stock-outputs', icon: ArrowUpRight, label: 'Saídas' },
      { to: '/stock-alerts', icon: Bell, label: 'Alertas' },
      { to: '/stock-inventories', icon: ClipboardCheck, label: 'Inventário' },
      { to: '/conversion-history', icon: ArrowRightLeft, label: 'Conversões' },
      { to: '/grain-discounts', icon: TrendingDown, label: 'Descontos de grãos' },
    ],
  },
  {
    title: 'PATRIMONIO',
    items: [
      { to: '/assets', icon: Tractor, label: 'Ativos' },
      { to: '/depreciation', icon: TrendingDown, label: 'Depreciacao' },
      { to: '/maintenance-plans', icon: Wrench, label: 'Planos de Manutencao' },
      { to: '/work-orders', icon: ClipboardList, label: 'Ordens de Servico' },
      { to: '/maintenance-dashboard', icon: BarChart3, label: 'Dashboard Manutencao' },
      { to: '/asset-inventories', icon: ClipboardCheck, label: 'Inventario Patrimonial' },
      { to: '/patrimony-dashboard', icon: BarChart3, label: 'Dashboard Patrimonial' },
      { to: '/biological-assets', icon: Leaf, label: 'Ativos Biologicos' },
      { to: '/asset-leasings', icon: FileText, label: 'Contratos Leasing' },
      { to: '/asset-reports', icon: FileBarChart, label: 'Relatorios' },
    ],
  },
  {
    title: 'FINANCEIRO',
    items: [
      { to: '/financial-dashboard', icon: LayoutDashboard, label: 'Dashboard' },
      { to: '/bank-accounts', icon: Building2, label: 'Contas bancárias' },
      { to: '/payables', icon: Receipt, label: 'Contas a pagar' },
      { to: '/receivables', icon: ReceiptText, label: 'Contas a receber' },
      { to: '/transfers', icon: ArrowLeftRight, label: 'Transferências' },
      { to: '/credit-cards', icon: CreditCard, label: 'Cartões' },
      { to: '/checks', icon: CheckSquare, label: 'Cheques' },
      { to: '/cashflow', icon: TrendingUp, label: 'Fluxo de caixa' },
      { to: '/reconciliation', icon: GitMerge, label: 'Conciliação bancária' },
      { to: '/rural-credit', icon: Landmark, label: 'Crédito Rural' },
    ],
  },
  {
    title: 'COMPRAS',
    items: [
      { to: '/purchasing-dashboard', icon: BarChart2, label: 'Dashboard Compras' },
      { to: '/purchasing-kanban', icon: Columns3, label: 'Kanban' },
      { to: '/suppliers', icon: Handshake, label: 'Fornecedores' },
      { to: '/purchase-requests', icon: ShoppingCart, label: 'Requisicoes' },
      { to: '/quotations', icon: FileSearch, label: 'Cotacoes' },
      { to: '/approval-rules', icon: Settings2, label: 'Alcadas' },
      { to: '/purchase-orders', icon: ClipboardList, label: 'Pedidos' },
      { to: '/goods-receipts', icon: PackageCheck, label: 'Recebimentos' },
      { to: '/goods-returns', icon: Undo2, label: 'Devoluções' },
      { to: '/purchase-budgets', icon: Wallet, label: 'Orçamento' },
      { to: '/saving-analysis', icon: BarChart3, label: 'Análise de Saving' },
    ],
  },
  {
    title: 'RH',
    items: [
      { to: '/hr-dashboard', icon: BarChart3, label: 'Dashboard RH' },
      { to: '/employees', icon: UserRound, label: 'Colaboradores' },
      { to: '/positions', icon: Briefcase, label: 'Cargos' },
      { to: '/work-schedules', icon: Calendar, label: 'Escalas' },
      { to: '/payroll-parameters', icon: Settings, label: 'Parâmetros de Folha' },
      { to: '/attendance', icon: Clock, label: 'Controle de Ponto' },
      { to: '/timesheets', icon: CalendarCheck, label: 'Espelho de Ponto' },
      { to: '/payroll-runs', icon: Receipt, label: 'Folha de Pagamento' },
      { to: '/vacation-schedules', icon: CalendarCheck, label: 'Ferias' },
      { to: '/employee-absences', icon: Stethoscope, label: 'Afastamentos' },
      { to: '/employee-terminations', icon: UserMinus, label: 'Rescisoes' },
      { to: '/payroll-provisions', icon: PiggyBank, label: 'Provisoes' },
    ],
  },
  {
    title: 'SEGURANÇA',
    items: [
      { to: '/epi-products', icon: HardHat, label: 'EPIs' },
      { to: '/epi-deliveries', icon: Package, label: 'Entregas EPI' },
      { to: '/training-types', icon: GraduationCap, label: 'Treinamentos' },
      { to: '/training-records', icon: ClipboardList, label: 'Registros de Treinamento' },
      { to: '/medical-exams', icon: Stethoscope, label: 'ASOs' },
      { to: '/safety-dashboard', icon: Shield, label: 'Dashboard NR-31' },
    ],
  },
  {
    title: 'OBRIGACOES',
    items: [
      { to: '/tax-guides', icon: Receipt, label: 'Guias de Recolhimento' },
      { to: '/esocial-events', icon: FileCode, label: 'Eventos eSocial' },
      { to: '/income-statements', icon: FileBarChart2, label: 'Informes de Rendimentos' },
    ],
  },
  {
    title: 'CONTABILIDADE',
    items: [
      { to: '/chart-of-accounts', icon: GitBranch, label: 'Plano de Contas' },
      { to: '/fiscal-periods', icon: Calendar, label: 'Períodos Fiscais' },
      { to: '/accounting-entries', icon: BookOpen, label: 'Lançamentos Contábeis' },
      { to: '/ledger', icon: BookOpen, label: 'Razão Contábil' },
      { to: '/trial-balance', icon: BarChart3, label: 'Balancete' },
      { to: '/monthly-closing', icon: ClipboardCheck, label: 'Fechamento Mensal' },
      { to: '/dre', icon: TrendingUp, label: 'DRE' },
      { to: '/balance-sheet', icon: Scale, label: 'Balanco Patrimonial' },
      { to: '/dfc', icon: ArrowLeftRight, label: 'DFC' },
      { to: '/cross-validation', icon: GitMerge, label: 'Validacao Cruzada' },
    ],
  },
  {
    title: 'CONFIGURAÇÃO',
    items: [
      { to: '/users', icon: Users, label: 'Usuários' },
      { to: '/roles', icon: Shield, label: 'Papéis' },
      { to: '/measurement-units', icon: Ruler, label: 'Unidades de medida' },
      { to: '/products', icon: Package, label: 'Produtos e serviços' },
      {
        to: '/notification-preferences',
        icon: BellRing,
        label: 'Preferencias de Notificacao',
      },
    ],
  },
];

function Sidebar({ isOpen, onClose }: SidebarProps) {
  const location = useLocation();
  const isActive = (path: string) => location.pathname.startsWith(path);
  const onCloseRef = useRef(onClose);
  const { count: overdueCount } = useOverdueCount();
  const { count: checkAlertCount } = useCheckAlertCount();
  const { count: ruralCreditAlertCount } = useRuralCreditAlertCount();
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onCloseRef.current();
    },
    [isOpen],
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Close drawer on route change (mobile)
  useEffect(() => {
    onCloseRef.current();
  }, [location.pathname]);

  return (
    <>
      {/* Mobile overlay */}
      <div
        className={`sidebar-overlay ${isOpen ? 'sidebar-overlay--visible' : ''}`}
        onClick={onClose}
        aria-hidden="true"
      />

      <aside
        className={`sidebar ${isOpen ? 'sidebar--open' : ''}`}
        aria-label="Navegação principal"
      >
        {/* Mobile close button */}
        <div className="sidebar__mobile-header">
          <span className="sidebar__mobile-title">Menu</span>
          <button
            type="button"
            className="sidebar__close"
            onClick={onClose}
            aria-label="Fechar menu"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        <nav className="sidebar__nav">
          {NAV_GROUPS.map((group) => (
            <div key={group.title} className="sidebar__group">
              <span className="sidebar__group-title">{group.title}</span>
              <ul className="sidebar__list">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(item.to);
                  const showOverdueBadge = item.to === '/payables' && overdueCount > 0;
                  const showCheckBadge = item.to === '/checks' && checkAlertCount > 0;
                  const showRuralCreditBadge =
                    item.to === '/rural-credit' && ruralCreditAlertCount > 0;
                  return (
                    <li key={item.to}>
                      <Link
                        to={item.to}
                        className={`sidebar__link ${active ? 'sidebar__link--active' : ''}`}
                        aria-current={active ? 'page' : undefined}
                        data-tooltip={item.label}
                      >
                        <Icon size={20} aria-hidden="true" className="sidebar__icon" />
                        <span className="sidebar__label">{item.label}</span>
                        {showOverdueBadge && (
                          <span
                            style={{
                              marginLeft: 'auto',
                              background: 'var(--color-error-600, #c62828)',
                              color: '#fff',
                              borderRadius: 100,
                              padding: '1px 7px',
                              fontSize: '0.6875rem',
                              fontWeight: 700,
                              fontFamily: "'Source Sans 3', system-ui, sans-serif",
                              flexShrink: 0,
                            }}
                            aria-label={`${overdueCount} títulos vencidos`}
                          >
                            {overdueCount > 99 ? '99+' : overdueCount}
                          </span>
                        )}
                        {showCheckBadge && (
                          <span
                            style={{
                              marginLeft: 'auto',
                              background: 'var(--color-warning-500, #ffc107)',
                              color: '#fff',
                              borderRadius: 100,
                              padding: '1px 7px',
                              fontSize: '0.6875rem',
                              fontWeight: 700,
                              fontFamily: "'JetBrains Mono', monospace",
                              flexShrink: 0,
                            }}
                            aria-label={`${checkAlertCount} cheques aguardando atenção`}
                          >
                            {checkAlertCount > 99 ? '99+' : checkAlertCount}
                          </span>
                        )}
                        {showRuralCreditBadge && (
                          <span
                            style={{
                              marginLeft: 'auto',
                              background: 'var(--color-error-600, #c62828)',
                              color: '#fff',
                              borderRadius: 100,
                              padding: '1px 7px',
                              fontSize: '0.6875rem',
                              fontWeight: 700,
                              fontFamily: "'Source Sans 3', system-ui, sans-serif",
                              flexShrink: 0,
                            }}
                            aria-label={`${ruralCreditAlertCount} parcela(s) de crédito rural vencendo em breve`}
                          >
                            {ruralCreditAlertCount > 99 ? '99+' : ruralCreditAlertCount}
                          </span>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
      </aside>
    </>
  );
}

export default Sidebar;
