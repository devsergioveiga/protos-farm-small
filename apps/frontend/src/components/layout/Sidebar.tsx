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
  BarChart3,
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
} from 'lucide-react';
import { useOverdueCount } from '@/hooks/usePayables';
import { useCheckAlertCount } from '@/hooks/useCheckAlertCount';
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
      { to: '/producers', icon: UserCheck, label: 'Produtores' },
    ],
  },
  {
    title: 'REBANHO',
    items: [
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
      { to: '/natural-matings', icon: Beef, label: 'Monta natural' },
      { to: '/pregnancy-diagnosis', icon: ScanLine, label: 'Diagnóstico gestação' },
      { to: '/calving-events', icon: Milestone, label: 'Partos e crias' },
      { to: '/weaning', icon: CupSoda, label: 'Desmama' },
      { to: '/sanitary-dashboard', icon: Activity, label: 'Dashboard sanitário' },
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
    title: 'FINANCEIRO',
    items: [
      { to: '/financial-dashboard', icon: LayoutDashboard, label: 'Dashboard' },
      { to: '/bank-accounts', icon: Building2, label: 'Contas bancárias' },
      { to: '/payables', icon: Receipt, label: 'Contas a pagar' },
      { to: '/receivables', icon: ReceiptText, label: 'Contas a receber' },
      { to: '/transfers', icon: ArrowLeftRight, label: 'Transferências' },
      { to: '/credit-cards', icon: CreditCard, label: 'Cartões' },
      { to: '/checks', icon: CheckSquare, label: 'Cheques' },
    ],
  },
  {
    title: 'CONFIGURAÇÃO',
    items: [
      { to: '/users', icon: Users, label: 'Usuários' },
      { to: '/roles', icon: Shield, label: 'Papéis' },
      { to: '/measurement-units', icon: Ruler, label: 'Unidades de medida' },
      { to: '/products', icon: Package, label: 'Produtos e serviços' },
    ],
  },
];

function Sidebar({ isOpen, onClose }: SidebarProps) {
  const location = useLocation();
  const isActive = (path: string) => location.pathname.startsWith(path);
  const onCloseRef = useRef(onClose);
  const { count: overdueCount } = useOverdueCount();
  const { count: checkAlertCount } = useCheckAlertCount();
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
