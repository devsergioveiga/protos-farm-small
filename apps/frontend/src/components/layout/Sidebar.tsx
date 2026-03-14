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
  Shovel,
  UsersRound,
  ClipboardList,
  Bug,
  FolderTree,
  Wheat,
  Tractor,
  Coffee,
  Citrus,
  HeartPulse,
  Syringe,
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
  X,
} from 'lucide-react';
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
