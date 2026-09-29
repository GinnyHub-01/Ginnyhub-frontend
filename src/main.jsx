import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  ArrowRight, Check, ChevronDown, ChevronLeft, ChevronRight, Heart, LockKeyhole, LogIn, LogOut, Mail, Menu, MessageCircle,
  Minus, Phone, Plus, RefreshCw, Search, ShoppingBag, Sparkles, Star, Truck, UserRound, UserPlus, X, Eye, EyeOff
} from 'lucide-react';
import './styles.css';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const WHATSAPP = '233550196536';
const flyer = '/flyer.webp';
const DEFAULT_SHIPPING = { fee: 15, freeOver: 200 }; // overridden by GET /config
const readJSON = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
const fallback = [
  ['Darling Crochet Braid 20"', 'Mesh Hair', 45],
  ['Olive Hair Oil', 'Hair Oil', 32],
  ['Coconut & Shea Butter Cream', 'Hair Cream', 28],
  ['20" Curly Mesh Hair', 'Mesh Hair', 55],
  ['Superstar Soft Wave', 'Mesh Hair', 52],
  ['Natural Hair Food', 'Hair Cream', 30],
].map((x, i) => ({
  _id: `demo${i}`, name: x[0], category: x[1], price: x[2], image: flyer,
  stock: 20, featured: i < 4, description: 'A carefully selected Ginnys Hub essential for beautiful everyday hair.'
}));

const money = n => `GH₵ ${Number(n || 0).toFixed(2)}`;
const round2 = n => Math.round(n * 100) / 100;
const authToken = () => localStorage.getItem('gh-token') || '';
const ROUTES = { '/': 'home', '/shop': 'shop', '/cart': 'cart', '/checkout': 'checkout', '/signin': 'signin', '/signup': 'signup', '/account': 'account', '/track': 'track' };
const parsePath = () => {
  const p = window.location.pathname.replace(/\/$/, '') || '/';
  const m = p.match(/^\/product\/([^/]+)$/);
  if (m) { try { return { route: 'product', param: decodeURIComponent(m[1]) }; } catch { return { route: 'notfound', param: null }; } }
  return { route: ROUTES[p] || 'notfound', param: null };
};
const routePath = (route, param) => route === 'home' ? '/' : route === 'product' ? `/product/${encodeURIComponent(param)}` : `/${route}`;

// Real <a href> links: middle-click / open-in-new-tab work, SPA navigation for normal clicks.
function Link({ to, param, go, className, children, ...rest }) {
  const onClick = e => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    go(to, param);
  };
  return <a href={routePath(to, param)} className={className} onClick={onClick} {...rest}>{children}</a>;
}

// Loads the catalogue with explicit loading / error states, a timeout, retry,
// and a re-fetch when the shopper comes back to a product page after a failure or a while away.
function useCatalog(route) {
  const [state, setState] = useState({ status: 'loading', products: [], error: '' });
  const loadedAt = useRef(0);
  const controller = useRef(null);

  const load = useCallback(async () => {
    controller.current?.abort();
    const ac = new AbortController();
    controller.current = ac;
    const timer = setTimeout(() => ac.abort(), 15000);
    setState(s => ({ ...s, status: s.products.length ? 'refreshing' : 'loading', error: '' }));
    try {
      const r = await fetch(`${API}/products`, { signal: ac.signal, cache: 'no-cache' });
      if (!r.ok) throw new Error(`Server responded ${r.status}`);
      const data = await r.json();
      if (!Array.isArray(data)) throw new Error('Unexpected response');
      loadedAt.current = Date.now();
      setState({ status: 'ready', products: data, error: '' });
    } catch {
      if (controller.current !== ac) return; // superseded by a newer request
      const error = ac.signal.aborted ? 'The shop is taking too long to respond.' : 'We could not load the products.';
      // Demo products are only for local development; never in production (their ids can't be ordered).
      setState(s => import.meta.env.DEV && !s.products.length
        ? { status: 'ready', products: fallback, error: '' }
        : { status: 'error', products: s.products, error });
    } finally { clearTimeout(timer); }
  }, []);

  useEffect(() => { load(); return () => controller.current?.abort(); }, [load]);
  useEffect(() => {
    if (route !== 'home' && route !== 'shop') return;
    const stale = state.status === 'ready' && Date.now() - loadedAt.current > 60000;
    if (state.status === 'error' || stale) load();
  }, [route]); // eslint-disable-line react-hooks/exhaustive-deps
  const statusRef = useRef(state.status);
  statusRef.current = state.status;
  useEffect(() => {
    const online = () => { if (statusRef.current === 'error') load(); };
    window.addEventListener('online', online);
    return () => window.removeEventListener('online', online);
  }, [load]);

  return { ...state, reload: load };
}

function useHomeBanners() {
  const [banners, setBanners] = useState([]);
  useEffect(() => {
    let alive = true;
    fetch(`${API}/home-banners`).then(r => (r.ok ? r.json() : [])).then(d => { if (alive) setBanners(Array.isArray(d) ? d : []); }).catch(() => {});
    return () => { alive = false; };
  }, []);
  return banners;
}

function App() {
  const [cart, setCart] = useState(() => readJSON('gh-cart', []));
  const [loc, setLoc] = useState(parsePath);
  const route = loc.route;
  const catalog = useCatalog(route);
  const homeBanners = useHomeBanners();
  const { products } = catalog;
  const [query, setQuery] = useState('');
  const [cat, setCat] = useState('All');
  const [mobileNav, setMobileNav] = useState(false);
  const [notice, setNotice] = useState('');
  const [favorites, setFavorites] = useState(() => readJSON('gh-favorites', []));
  const [shipping, setShipping] = useState(DEFAULT_SHIPPING);
  const [user, setUser] = useState(() => readJSON('gh-user', null));

  useEffect(() => {
    fetch(`${API}/config`).then(r => r.json()).then(c => {
      if (Number.isFinite(c.deliveryFee) && Number.isFinite(c.freeDeliveryThreshold)) setShipping({ fee: c.deliveryFee, freeOver: c.freeDeliveryThreshold });
    }).catch(() => {});
  }, []);
  useEffect(() => localStorage.setItem('gh-cart', JSON.stringify(cart)), [cart]);
  // Wishlist: guests keep it in localStorage; signed-in customers get it synced to their account,
  // merging in anything they favourited before signing in.
  useEffect(() => {
    if (!user) return;
    const token = authToken();
    if (!token) return;
    (async () => {
      try {
        const r = await fetch(`${API}/account/favorites`, { headers: { Authorization: `Bearer ${token}` } });
        if (!r.ok) return;
        const serverIds = await r.json();
        const local = readJSON('gh-favorites', []);
        const toMerge = local.filter(id => !serverIds.includes(id));
        if (toMerge.length) {
          await Promise.all(toMerge.map(id => fetch(`${API}/account/favorites/${id}`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } }).catch(() => {})));
        }
        setFavorites([...serverIds, ...toMerge]);
        localStorage.removeItem('gh-favorites');
      } catch { /* keep whatever favourites are already showing */ }
    })();
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!user) localStorage.setItem('gh-favorites', JSON.stringify(favorites)); }, [favorites, user]);
  useEffect(() => {
    const sync = () => setLoc(parsePath());
    window.addEventListener('popstate', sync);
    return () => window.removeEventListener('popstate', sync);
  }, []);
  useEffect(() => window.scrollTo({ top: 0, behavior: 'instant' }), [loc.route, loc.param]);

  const filtered = useMemo(() => products.filter(p =>
    (cat === 'All' || p.category === cat) && p.name.toLowerCase().includes(query.toLowerCase())
  ), [products, cat, query]);
  const featured = useMemo(() => {
    const f = products.filter(p => p.featured);
    return (f.length ? f : products).slice(0, 4);
  }, [products]);
  const items = cart.reduce((s, i) => s + i.quantity, 0);
  const subtotal = cart.reduce((s, i) => s + i.price * i.quantity, 0);
  const delivery = subtotal >= shipping.freeOver || subtotal === 0 ? 0 : shipping.fee;
  const total = subtotal + delivery;

  const go = (path, param) => {
    const next = routePath(path, param);
    if (window.location.pathname !== next) window.history.pushState({ route: path, param }, '', next);
    setLoc({ route: path, param: param ?? null });
    setMobileNav(false);
  };
  const signOut = () => { localStorage.removeItem('gh-user'); localStorage.removeItem('gh-token'); localStorage.removeItem('gh-favorites'); setUser(null); setFavorites([]); go('home'); };
  // One toast at a time: a new message cancels the previous timer so an old timeout can't hide it early.
  const noticeTimer = useRef(null);
  const flash = (msg, ms = 2600) => { clearTimeout(noticeTimer.current); setNotice(msg); noticeTimer.current = setTimeout(() => setNotice(''), ms); };
  // Adds `qty` of a product, never more than what is in stock.
  const add = (p, qty = 1) => {
    const stock = Number.isFinite(Number(p.stock)) ? Number(p.stock) : Infinity;
    const inBag = cart.find(x => x.productId === p._id)?.quantity || 0;
    const n = Math.min(qty, stock - inBag);
    if (n <= 0) { flash(`You already have all ${stock} in your bag`); return; }
    setCart(c => c.some(x => x.productId === p._id)
      ? c.map(x => x.productId === p._id ? { ...x, quantity: x.quantity + n, stock: Number.isFinite(stock) ? stock : x.stock } : x)
      : [...c, { productId: p._id, slug: p.slug, name: p.name, category: p.category, price: Number(p.price), image: p.image, stock: Number.isFinite(stock) ? stock : undefined, quantity: n }]);
    flash(n < qty ? `Only ${stock} in stock. Added ${n}.` : `${p.name} added to your bag`);
  };
  const changeQty = (id, delta) => setCart(c => c.map(i => i.productId === id ? { ...i, quantity: Math.min(i.stock ?? 99, Math.max(1, i.quantity + delta)) } : i));
  const remove = id => setCart(c => c.filter(i => i.productId !== id));
  const toggleFavorite = id => {
    const active = favorites.includes(id);
    setFavorites(f => active ? f.filter(x => x !== id) : [...f, id]);
    if (user) {
      const token = authToken();
      if (token) fetch(`${API}/account/favorites/${id}`, { method: active ? 'DELETE' : 'POST', headers: { Authorization: `Bearer ${token}` } }).catch(() => {});
    }
  };

  return <div className="site-shell">
    <Announcement />
    <Header items={items} query={query} setQuery={setQuery} mobileNav={mobileNav} setMobileNav={setMobileNav} go={go} user={user} signOut={signOut} />

    {route === 'home' && <Home featured={featured} catalog={catalog} add={add} go={go} favorites={favorites} toggleFavorite={toggleFavorite} banners={homeBanners} />}
    {route === 'shop' && <Shop products={filtered} catalog={catalog} query={query} setQuery={setQuery} cat={cat} setCat={setCat} add={add} go={go} favorites={favorites} toggleFavorite={toggleFavorite} />}
    {route === 'product' && <ProductPage slug={loc.param} catalog={catalog} add={add} go={go} freeOver={shipping.freeOver} favorites={favorites} toggleFavorite={toggleFavorite} />}
    {route === 'notfound' && <NotFound go={go} />}
    {route === 'cart' && <Cart cart={cart} subtotal={subtotal} delivery={delivery} freeOver={shipping.freeOver} total={total} changeQty={changeQty} remove={remove} go={go} />}
    {route === 'signin' && <Auth mode="signin" go={go} setUser={setUser} notify={flash} />}
    {route === 'signup' && <Auth mode="signup" go={go} setUser={setUser} notify={flash} />}
    {route === 'account' && <Account go={go} user={user} setUser={setUser} notify={flash} initialTab={loc.param} /> }
    {route === 'checkout' && <Checkout cart={cart} subtotal={subtotal} delivery={delivery} freeOver={shipping.freeOver} shippingFee={shipping.fee} total={total} setCart={setCart} go={go} notify={flash} reload={catalog.reload} />}
    {route === 'track' && <TrackOrder go={go} />}

    <Footer go={go} />
    {notice && <div className="toast"><Check size={17} />{notice}</div>}
  </div>;
}

function Announcement() {
  return <div className="announcement"><span>Ginnys Hub</span><span>Quality hair & hair-care essentials</span><a href={`https://wa.me/${WHATSAPP}`}>WhatsApp 0550196536 <ArrowRight size={13} /></a></div>;
}

function AccountMenu({ go, user, signOut }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const onDocClick = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onEsc = e => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onEsc);
    return () => { document.removeEventListener('mousedown', onDocClick); document.removeEventListener('keydown', onEsc); };
  }, [open]);
  const goTab = tab => { setOpen(false); go('account', tab); };
  return <div className="account-menu" ref={ref}>
    <button className="account-button" onClick={() => setOpen(o => !o)} aria-haspopup="true" aria-expanded={open} title="My account">
      <UserRound size={18} /><span>{user.name ? user.name.split(' ')[0] : 'Account'}</span><ChevronDown size={13} className={open ? 'caret open' : 'caret'} />
    </button>
    {open && <div className="account-dropdown" role="menu">
      <div className="account-dropdown-head"><b>{user.name}</b><small>{user.email}</small></div>
      <button role="menuitem" onClick={() => goTab('profile')}><UserRound size={15} /> Profile</button>
      <button role="menuitem" onClick={() => goTab('orders')}><ShoppingBag size={15} /> Orders</button>
      <button role="menuitem" className="danger" onClick={() => { setOpen(false); signOut(); }}><LogOut size={15} /> Logout</button>
    </div>}
  </div>;
}

function Header({ items, query, setQuery, mobileNav, setMobileNav, go, user, signOut }) {
  return <header className="header">
    <div className="header-inner">
      <button className="mobile-menu" onClick={() => setMobileNav(!mobileNav)} aria-label="Menu">{mobileNav ? <X /> : <Menu />}</button>
      <Link to="home" go={go} className="logo" aria-label="Ginnys Hub home"><img src="/ginnys-logo.webp" alt="Ginnys Hub" width="170" height="86" /></Link>
      <nav className={mobileNav ? 'nav open' : 'nav'}>
        <Link to="home" go={go}>Home</Link>
        <Link to="shop" go={go}>Shop</Link>
        <Link to="shop" go={go}>Mesh Hair</Link>
        <Link to="shop" go={go}>Hair Care</Link>
        <a href={`https://wa.me/${WHATSAPP}`}>Contact</a>
        {user ? <>
          <button className="mobile-account-link" onClick={() => { setMobileNav(false); go('account', 'profile'); }}>Profile</button>
          <button className="mobile-account-link" onClick={() => { setMobileNav(false); go('account', 'orders'); }}>Orders</button>
          <button className="mobile-account-link" onClick={() => { setMobileNav(false); signOut(); }}>Logout</button>
        </> : <button className="mobile-account-link" onClick={() => go('signin')}>Sign in</button>}
      </nav>
      <div className="header-tools">
        <label className="search-pill"><Search size={17} /><input value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && go('shop')} placeholder="Search products" /></label>
        {user ? <AccountMenu go={go} user={user} signOut={signOut} /> : <button className="account-button" onClick={() => go('signin')} title="Sign in"><UserRound size={18} /><span>Sign in</span></button>}
        <button className="bag-button" onClick={() => go('cart')} aria-label="Cart"><ShoppingBag size={21} /><span>{items}</span></button>
      </div>
    </div>
  </header>;
}

const SLIDES = [
  { kicker: 'THE GINNYS EDIT', title: <>Your crown.<br /><i>Your way.</i></>, text: 'Modern hair shopping for mesh styles, nourishing creams and everyday essentials.', cta: 'Shop the collection' },
  { kicker: 'QUALITY HAIR, EASY CHOICE', title: <>Looks good.<br /><i>Feels right.</i></>, text: 'Discover practical hair-care favourites selected for your routine and your next look.', cta: 'Explore hair care' },
  { kicker: 'MADE FOR YOUR ROUTINE', title: <>Good hair days<br /><i>start here.</i></>, text: 'Fresh styles, trusted essentials and simple ordering, all in one place.', cta: 'Browse products' }
];

// The carousel timer lives here, so only the hero re-renders every 6s (not the whole app).
function Hero({ go }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setI(n => (n + 1) % SLIDES.length), 6000);
    return () => clearInterval(timer);
  }, []);
  const s = SLIDES[i];
  return <section className="hero-modern">
    <div className="hero-copy page-width">
      <div className="hero-text reveal-up" key={i}>
        <div className="eyebrow"><Sparkles size={15} /> {s.kicker}</div>
        <h1>{s.title}</h1>
        <p>{s.text}</p>
        <div className="hero-actions"><button className="primary" onClick={() => go('shop')}>{s.cta} <ArrowRight size={18} /></button><a className="secondary" href={`https://wa.me/${WHATSAPP}`}><MessageCircle size={17} /> WhatsApp us</a></div>
        <div className="hero-meta"><span><Check size={15} /> Quality selected</span><span><Check size={15} /> Ghana delivery</span></div>
      </div>
      <div className="hero-visual">
        <div className="visual-orbit orbit-one" /><div className="visual-orbit orbit-two" />
        <div className="hero-image-wrap"><img src={flyer} alt="Ginnys Hub hair products" width="430" height="510" fetchPriority="high" decoding="async" /><div className="quality-chip"><b>100%</b><span>QUALITY</span></div></div>
        <div className="floating-product"><span>Featured</span><b>Mesh Hair</b><small>Fresh styles · easy ordering</small></div>
      </div>
    </div>
    <div className="hero-dots">{SLIDES.map((_, n) => <button key={n} className={n === i ? 'active' : ''} onClick={() => setI(n)} aria-label={`Slide ${n + 1}`} />)}</div>
  </section>;
}

function PromoBanner({ b, go }) {
  const isExternal = /^https?:\/\//i.test(b.ctaLink || '');
  const style = b.theme === 'custom' ? { '--promo-bg': b.bgColor || undefined, '--promo-fg': b.textColor || undefined } : undefined;
  return <section className={`promo-banner theme-${b.theme || 'default'}`} style={style}>
    <div className={`promo-inner page-width${b.image ? '' : ' no-image'}`}>
      {b.image && <div className="promo-image"><img src={b.image} alt="" loading="lazy" /></div>}
      <div className="promo-text">
        {b.badge && <span className="promo-badge">{b.badge}</span>}
        <h2>{b.title}</h2>
        {b.subtitle && <p>{b.subtitle}</p>}
        {b.ctaLabel && (isExternal
          ? <a className="primary" href={b.ctaLink} target="_blank" rel="noopener noreferrer">{b.ctaLabel} <ArrowRight size={16} /></a>
          : <button className="primary" onClick={() => go(b.ctaLink || 'shop')}>{b.ctaLabel} <ArrowRight size={16} /></button>)}
      </div>
    </div>
  </section>;
}

function Home({ featured, catalog, add, go, favorites, toggleFavorite, banners = [] }) {
  return <main>
    <Hero go={go} />
    {banners.map(b => <PromoBanner key={b._id} b={b} go={go} />)}

    <section className="trust-strip"><div><Truck /><span><b>Simple delivery</b><small>Convenient local delivery</small></span></div><div><Star /><span><b>Quality first</b><small>Selected hair essentials</small></span></div><div><MessageCircle /><span><b>Need help?</b><small>Chat with us on WhatsApp</small></span></div></section>

    <section className="section page-width featured-section">
      <SectionTitle eyebrow="CURATED FOR YOU" title="The favourites" action="View all" onAction={() => go('shop')} />
      <CatalogGrid catalog={catalog} products={featured} count={4} empty={<div className="no-results"><h3>New products are on the way</h3><p>Check back soon.</p></div>} add={add} go={go} favorites={favorites} toggleFavorite={toggleFavorite} />
    </section>

    <section className="editorial page-width">
      <div className="editorial-card editorial-main"><div><p className="eyebrow">MESH HAIR</p><h2>Change the look.<br /><i>Keep the confidence.</i></h2><p>Explore braids, curls and protective styles selected for easy everyday beauty.</p><button className="outline" onClick={() => go('shop')}>Shop mesh hair <ArrowRight size={16} /></button></div><div className="editorial-glow" /></div>
      <div className="editorial-card editorial-care"><div><p className="eyebrow">HAIR CARE</p><h3>Feed your hair.<br />Love the routine.</h3><button className="outline" onClick={() => go('shop')}>Shop care <ArrowRight size={16} /></button></div><div className="care-badge">Coconut<br /><span>& Shea</span></div></div>
    </section>

    <section className="mini-about page-width"><div><p className="eyebrow">WHY GINNYS HUB</p><h2>Beautiful essentials,<br /><i>without the fuss.</i></h2></div><p>We make it easy to find quality mesh hair and hair-care products that fit real routines. Browse, add to bag and order in a few taps.</p></section>
  </main>;
}

function Shop({ products, catalog, query, setQuery, cat, setCat, add, go, favorites, toggleFavorite }) {
  return <main className="shop-page page-width"><div className="page-heading"><div><p className="eyebrow">THE COLLECTION</p><h1>Shop all products</h1><p>Mesh hair, creams and oils for your next look.</p></div><div className="shop-search"><Search size={18} /><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search the collection" /></div></div><div className="category-row">{['All', 'Mesh Hair', 'Hair Cream', 'Hair Oil'].map(c => <button className={cat === c ? 'active' : ''} onClick={() => setCat(c)} key={c}>{c}</button>)}</div><CatalogGrid catalog={catalog} products={products} count={8} empty={<div className="no-results"><Search size={30} /><h3>No products found</h3><p>Try another search or category.</p></div>} add={add} go={go} favorites={favorites} toggleFavorite={toggleFavorite} /></main>;
}

function ProductGrid({ products, add, go, favorites, toggleFavorite }) {
  return <div className="product-grid">{products.map((p, i) => {
    const soldOut = Number(p.stock) <= 0;
    const key = p.slug || p._id;
    return <article className="product-card" key={p._id} style={{ '--delay': `${Math.min(i, 7) * 40}ms` }}>
      <div className="product-media"><Link to="product" param={key} go={go} className="media-link" aria-label={`View ${p.name}`}><img src={p.image || flyer} alt={p.name} width="400" height="330" loading="lazy" decoding="async" /></Link><button className={favorites.includes(p._id) ? 'fav active' : 'fav'} onClick={() => toggleFavorite(p._id)} aria-label="Save to favourites"><Heart size={18} fill={favorites.includes(p._id) ? 'currentColor' : 'none'} /></button>{soldOut ? <span className="badge sold-out">Sold out</span> : (p.featured || i === 0) && <span className="badge">Featured</span>}<button className="quick-add" onClick={() => add(p)} disabled={soldOut}>{soldOut ? 'Sold out' : <>Add to bag <Plus size={15} /></>}</button></div>
      <div className="product-info"><div className="product-category">{p.category}</div><h3><Link to="product" param={key} go={go}>{p.name}</Link></h3><div className="product-bottom"><b>{money(p.price)}</b><span><Star size={13} fill="currentColor" /> {p.ratingCount ? `${Number(p.ratingAverage || 0).toFixed(1)} (${p.ratingCount})` : 'New'}</span></div></div>
    </article>;
  })}</div>;
}

function SkeletonGrid({ count }) {
  return <div className="product-grid" aria-busy="true" aria-label="Loading products">{Array.from({ length: count }, (_, i) => <div key={i}><div className="sk sk-media" /><div className="sk sk-line short" /><div className="sk sk-line" /></div>)}</div>;
}

function LoadError({ message, onRetry }) {
  return <div className="load-error" role="alert"><RefreshCw size={30} /><h3>{message}</h3><p>Please check your connection and try again.</p><button className="primary" onClick={onRetry}>Try again <RefreshCw size={15} /></button></div>;
}

// One place that decides: skeletons while loading, retry on failure, or the grid.
function CatalogGrid({ catalog, products, count, empty, ...grid }) {
  if (catalog.status === 'loading') return <SkeletonGrid count={count} />;
  if (catalog.status === 'error' && !catalog.products.length) return <LoadError message={catalog.error} onRetry={catalog.reload} />;
  return <>
    {catalog.status === 'error' && <div className="stale-banner" role="status"><span>{catalog.error} Showing the last products we loaded.</span><button onClick={catalog.reload}><RefreshCw size={13} /> Retry</button></div>}
    {products.length ? <ProductGrid products={products} {...grid} /> : empty}
  </>;
}

function NotFound({ go }) {
  return <main className="pd page-width"><div className="load-error"><Search size={30} /><h3>Page not found</h3><p>The page you are looking for does not exist.</p><Link to="home" go={go} className="primary link-btn">Back to home <ArrowRight size={16} /></Link></div></main>;
}

function ProductPage({ slug, catalog, add, go, freeOver, favorites, toggleFavorite }) {
  const find = list => list.find(x => x.slug === slug || x._id === slug) || null;
  const [state, setState] = useState(() => { const c = find(catalog.products); return { status: c ? 'ready' : 'loading', product: c }; });
  const [qty, setQty] = useState(1);
  const [imgIdx, setImgIdx] = useState(0);
  const [attempt, setAttempt] = useState(0);

  // Show what the catalogue already has instantly, then refresh from the API (fresh stock; 404 for unknown/hidden products).
  useEffect(() => {
    let cancelled = false;
    const cached = find(catalog.products);
    setState({ status: cached ? 'ready' : 'loading', product: cached });
    setQty(1); setImgIdx(0);
    (async () => {
      try {
        const r = await fetch(`${API}/products/${encodeURIComponent(slug)}`, { cache: 'no-cache' });
        if (r.status === 404) { if (!cancelled) setState({ status: 'notfound', product: null }); return; }
        if (!r.ok) throw new Error('bad status');
        const product = await r.json();
        if (!cancelled) setState({ status: 'ready', product });
      } catch {
        if (!cancelled) setState(s => s.product ? s : { status: 'error', product: null });
      }
    })();
    return () => { cancelled = true; };
  }, [slug, attempt]); // eslint-disable-line react-hooks/exhaustive-deps

  const p = state.product;
  useEffect(() => {
    if (!p) return;
    const previous = document.title;
    document.title = `${p.name} — Ginnys Hub`;
    return () => { document.title = previous; };
  }, [p?.name]); // eslint-disable-line react-hooks/exhaustive-deps

  if (state.status === 'loading') return <main className="pd page-width" aria-busy="true"><div className="pd-grid"><div className="sk sk-media pd-sk" /><div><div className="sk sk-line short" /><div className="sk sk-line" /><div className="sk sk-line" /><div className="sk sk-line short" /></div></div></main>;
  if (state.status === 'notfound') return <main className="pd page-width"><div className="load-error"><Search size={30} /><h3>We could not find that product</h3><p>It may have been removed or is no longer available.</p><Link to="shop" go={go} className="primary link-btn">Browse the shop <ArrowRight size={16} /></Link></div></main>;
  if (state.status === 'error') return <main className="pd page-width"><LoadError message="We could not load this product." onRetry={() => setAttempt(a => a + 1)} /></main>;

  const images = [...new Set([p.image, ...(p.images || [])].filter(Boolean))];
  if (!images.length) images.push(flyer);
  const stock = Number(p.stock);
  const soldOut = !(stock > 0);
  const low = stock > 0 && stock <= 5;
  const maxQty = Math.max(1, Math.min(stock || 1, 99));
  const onSale = Number(p.compareAtPrice) > Number(p.price);
  const off = onSale ? Math.round((1 - Number(p.price) / Number(p.compareAtPrice)) * 100) : 0;
  const related = catalog.products.filter(x => x.category === p.category && x._id !== p._id).slice(0, 4);
  const fav = favorites.includes(p._id);
  const ask = `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(`Hi Ginnys Hub, I'm interested in ${p.name} (${window.location.href})`)}`;

  return <main className="pd page-width">
    <nav className="crumbs" aria-label="Breadcrumb">
      <Link to="home" go={go}>Home</Link><ChevronRight size={13} /><Link to="shop" go={go}>Shop</Link><ChevronRight size={13} />
      <span>{p.category}</span><ChevronRight size={13} /><span aria-current="page">{p.name}</span>
    </nav>
    <div className="pd-grid">
      <div className="pd-gallery">
        <div className="pd-main">
          <img src={images[Math.min(imgIdx, images.length - 1)]} alt={p.name} width="640" height="640" fetchPriority="high" decoding="async" />
          {soldOut ? <span className="badge sold-out">Sold out</span> : p.badge ? <span className="badge">{p.badge}</span> : onSale ? <span className="badge">{off}% off</span> : null}
        </div>
        {images.length > 1 && <div className="pd-thumbs">{images.map((src, i) => <button key={src + i} className={i === imgIdx ? 'active' : ''} onClick={() => setImgIdx(i)} aria-label={`Show image ${i + 1}`}><img src={src} alt="" width="72" height="72" loading="lazy" decoding="async" /></button>)}</div>}
      </div>
      <div className="pd-info">
        <p className="eyebrow">{p.category}</p>
        <h1>{p.name}</h1>
        <div className="pd-price"><b>{money(p.price)}</b>{onSale && <s>{money(p.compareAtPrice)}</s>}</div>
        <p className={`pd-stock${soldOut ? ' out' : low ? ' low' : ''}`}>{soldOut ? 'Sold out' : low ? `Only ${stock} left` : 'In stock'}</p>
        <p className="pd-desc">{p.description || 'A carefully selected Ginnys Hub essential for beautiful everyday hair.'}</p>
        {!soldOut && <div className="pd-buy">
          <div className="qty pd-qty">
            <button onClick={() => setQty(q => Math.max(1, q - 1))} disabled={qty <= 1} aria-label="Decrease quantity"><Minus size={15} /></button>
            <span aria-live="polite">{qty}</span>
            <button onClick={() => setQty(q => Math.min(maxQty, q + 1))} disabled={qty >= maxQty} aria-label="Increase quantity"><Plus size={15} /></button>
          </div>
          <button className="primary" onClick={() => add(p, qty)}>Add to bag <ShoppingBag size={16} /></button>
        </div>}
        <div className="pd-actions">
          <a className="secondary" href={ask}><MessageCircle size={16} /> Ask on WhatsApp</a>
          <button className="secondary" onClick={() => toggleFavorite(p._id)} aria-pressed={fav}><Heart size={16} fill={fav ? 'currentColor' : 'none'} /> {fav ? 'Saved' : 'Save'}</button>
        </div>
        <ul className="pd-points">
          <li><Truck size={16} /> Delivery across Ghana{freeOver ? `, free over ${money(freeOver)}` : ''}</li>
          <li><Check size={16} /> Pay on delivery or with Mobile Money</li>
        </ul>
      </div>
    </div>

    <ProductReviews product={p} />
    {related.length > 0 && <section className="pd-related"><div className="section-title"><h2>You may also like</h2></div><ProductGrid products={related} add={add} go={go} favorites={favorites} toggleFavorite={toggleFavorite} /></section>}
  </main>;
}

function ProductReviews({ product }) {
  const [data,setData]=useState({reviews:[],summary:{average:0,count:0}});
  const [eligibility,setEligibility]=useState(null);
  const [rating,setRating]=useState(5);
  const [comment,setComment]=useState('');
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState('');
  const [error,setError]=useState('');

  useEffect(() => {
    let cancelled=false;
    fetch(`${API}/reviews/product/${product._id}`).then(r=>r.ok?r.json():null).then(d=>{if(!cancelled&&d)setData(d)}).catch(()=>{});
    const token=authToken();
    if(token) fetch(`${API}/reviews/product/${product._id}/eligibility`,{headers:{Authorization:`Bearer ${token}`}})
      .then(r=>r.ok?r.json():null).then(d=>{if(!cancelled&&d)setEligibility(d)}).catch(()=>{});
    return ()=>{cancelled=true};
  },[product._id]);

  async function submit(e){
    e.preventDefault(); setBusy(true); setError(''); setMessage('');
    try{
      const r=await fetch(`${API}/reviews/product/${product._id}`,{
        method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${authToken()}`},
        body:JSON.stringify({rating,comment,orderId:eligibility.orderId})
      });
      const d=await r.json().catch(()=>({}));
      if(!r.ok) throw new Error(d.message||'Could not submit your review.');
      setData(v=>({...v,reviews:[d,...v.reviews],summary:{average:v.summary.count?Number(((v.summary.average*v.summary.count+d.rating)/(v.summary.count+1)).toFixed(1)):d.rating,count:v.summary.count+1}}));
      setEligibility({eligible:false,reason:'You have already reviewed this purchase.'}); setComment(''); setMessage('Thank you for sharing your experience.');
    }catch(e){setError(e.message)}finally{setBusy(false)}
  }

  return <section className="pd-reviews">
    <div className="section-title"><div><p className="eyebrow">CUSTOMER REVIEWS</p><h2>What customers say</h2></div>
      <div className="review-summary"><strong>{data.summary.average ? data.summary.average.toFixed(1) : '—'}</strong><span>{[1,2,3,4,5].map(i=><Star key={i} size={15} fill={i<=Math.round(data.summary.average)?'currentColor':'none'}/>)}</span><small>{data.summary.count} review{data.summary.count===1?'':'s'}</small></div>
    </div>
    {authToken() && eligibility?.eligible && <form className="review-form" onSubmit={submit}>
      <div className="review-stars" aria-label="Rating">{[1,2,3,4,5].map(i=><button type="button" key={i} className={i<=rating?'selected':''} onClick={()=>setRating(i)} aria-label={`${i} star`}>★</button>)}</div>
      <textarea value={comment} onChange={e=>setComment(e.target.value)} placeholder="Tell other shoppers about your experience…" maxLength={1000} required />
      {error&&<p className="review-error">{error}</p>}{message&&<p className="review-success">{message}</p>}
      <button className="primary" disabled={busy}>{busy?'Publishing…':'Publish review'}</button>
    </form>}
    {!authToken() && <p className="review-note">Sign in and purchase this product to leave a verified review after delivery.</p>}
    {authToken() && eligibility && !eligibility.eligible && <p className="review-note">{eligibility.reason}</p>}
    <div className="review-list">{!data.reviews.length?<p className="review-note">No reviews yet. Be the first verified customer to share your experience.</p>:data.reviews.map(r=><article className="review" key={r._id}><div className="review-head"><b>{r.userId?.name||'Verified customer'}</b><span>{[1,2,3,4,5].map(i=><Star key={i} size={13} fill={i<=r.rating?'currentColor':'none'}/>)}</span></div><p>{r.comment}</p><small>Verified purchase · {new Date(r.createdAt).toLocaleDateString()}</small></article>)}</div>
  </section>;
}

function SectionTitle({ eyebrow, title, action, onAction }) { return <div className="section-title"><div><p className="eyebrow">{eyebrow}</p><h2>{title}</h2></div>{action && <button className="text-button" onClick={onAction}>{action} <ArrowRight size={16} /></button>}</div>; }

function Cart({ cart, subtotal, delivery, freeOver, total, changeQty, remove, go }) {
  return <main className="cart-page page-width"><div className="page-heading compact"><div><p className="eyebrow">YOUR BAG</p><h1>Shopping cart</h1><p>{cart.length ? `${cart.reduce((s, i) => s + i.quantity, 0)} item(s) selected` : 'Your bag is ready when you are.'}</p></div><button className="back-shop" onClick={() => go('shop')}><ChevronLeft size={17} /> Continue shopping</button></div>{!cart.length ? <div className="empty-state"><div className="empty-icon"><ShoppingBag /></div><h2>Your bag is empty</h2><p>Find a new mesh style or a hair-care favourite.</p><button className="primary" onClick={() => go('shop')}>Start shopping <ArrowRight size={17} /></button></div> : <div className="cart-layout"><div className="cart-list">{cart.map(i => <div className="cart-row" key={i.productId}><img src={i.image || flyer} alt={i.name} width="90" height="105" loading="lazy" decoding="async" /><div className="cart-details"><small>{i.category || 'Ginnys Hub'}</small><h3>{i.slug ? <Link to="product" param={i.slug} go={go}>{i.name}</Link> : i.name}</h3><b>{money(i.price)}</b></div><div className="qty"><button onClick={() => changeQty(i.productId, -1)}><Minus size={15} /></button><span>{i.quantity}</span><button onClick={() => changeQty(i.productId, 1)} disabled={i.quantity >= (i.stock ?? 99)} aria-label="Increase quantity"><Plus size={15} /></button></div><button className="remove" onClick={() => remove(i.productId)}>Remove</button></div>)}</div><Summary subtotal={subtotal} delivery={delivery} freeOver={freeOver} total={total} go={go} /></div>}</main>;
}

function Summary({ subtotal, delivery, freeOver, total, go, showCta = true, coupon, couponCode, setCouponCode, applyCoupon, removeCoupon, couponBusy, couponError }) {
  const showCouponBox = typeof applyCoupon === 'function';
  return <aside className="summary">
    <div className="summary-top"><span>Order summary</span><Sparkles size={17} /></div>
    <div className="summary-line"><span>Subtotal</span><b>{money(subtotal)}</b></div>
    {coupon && <div className="summary-line discount-line"><span>Discount ({coupon.code}) <button type="button" className="remove-coupon" onClick={removeCoupon}>Remove</button></span><b>−{money(coupon.discount)}</b></div>}
    <div className="summary-line"><span>Delivery</span><b>{delivery ? money(delivery) : 'Free'}</b></div>
    {delivery > 0 && <p className="delivery-note">Free delivery on orders over {money(freeOver)}.</p>}
    <div className="summary-total"><span>Total</span><b>{money(total)}</b></div>
    {showCouponBox && !coupon && <div className="coupon-box">
      <input value={couponCode} onChange={e => setCouponCode(e.target.value.toUpperCase())} placeholder="Coupon code" onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); applyCoupon(); } }} />
      <button type="button" className="secondary" onClick={applyCoupon} disabled={couponBusy || !couponCode.trim()}>{couponBusy ? 'Checking…' : 'Apply'}</button>
    </div>}
    {couponError && <p className="coupon-error">{couponError}</p>}
    {showCta && <button className="primary wide" onClick={() => go('checkout')}>Continue to checkout <ArrowRight size={17} /></button>}
    <p className="secure-note">Secure ordering · WhatsApp support available</p>
  </aside>;
}

function Account({go,user,setUser,notify,initialTab}) {
  const [profile,setProfile]=useState(user||{}), [orders,setOrders]=useState([]), [notifications,setNotifications]=useState({items:[],unread:0}), [tab,setTab]=useState(initialTab||'overview'), [busy,setBusy]=useState(false), [saving,setSaving]=useState(false), [message,setMessage]=useState(''), [error,setError]=useState('');
  useEffect(()=>{ if(initialTab) setTab(initialTab); },[initialTab]);

  const request=useCallback(async(url,options={},timeout=8000)=>{
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),timeout);
    try{return await fetch(url,{...options,signal:controller.signal});}
    finally{clearTimeout(timer)}
  },[]);

  const load=useCallback(async()=>{
    const token=authToken();
    if(!token){go('signin');return;}
    setBusy(true); setError('');
    const h={Authorization:`Bearer ${token}`};
    try{
      const a=await request(`${API}/account/me`,{headers:h});
      const ad=await a.json().catch(()=>({}));
      if(a.status===401){localStorage.removeItem('gh-token');localStorage.removeItem('gh-user');setUser(null);go('signin');return;}
      if(!a.ok) throw new Error(ad.message||'Could not load your profile.');
      setProfile(ad);setUser(ad);
      setBusy(false);

      const results=await Promise.allSettled([
        request(`${API}/account/orders`,{headers:h}).then(r=>r.ok?r.json():[]),
        request(`${API}/notifications?limit=50`,{headers:h}).then(r=>r.ok?r.json():{items:[],unread:0})
      ]);
      if(results[0].status==='fulfilled') setOrders(Array.isArray(results[0].value)?results[0].value:[]);
      if(results[1].status==='fulfilled') setNotifications(results[1].value||{items:[],unread:0});
      if(results.some(r=>r.status==='rejected')) setMessage('Some account updates could not be loaded.');
    }catch(err){
      setBusy(false);
      setError(err?.name==='AbortError'?'The account service took too long to respond. Please try again.':(err?.message||'We could not load your account.'));
    }
  },[go,setUser,request]);

  useEffect(()=>{load()},[load]);

  async function save(e){
    e.preventDefault();setSaving(true);setMessage('');
    try{
      const f=new FormData(e.currentTarget);
      const r=await request(`${API}/account/me`,{method:'PATCH',headers:{'Content-Type':'application/json',Authorization:`Bearer ${authToken()}`},body:JSON.stringify({name:f.get('name'),phone:f.get('phone')})});
      const d=await r.json().catch(()=>({}));
      if(!r.ok)throw new Error(d.message||'Could not update profile');
      setProfile(d);setUser(d);localStorage.setItem('gh-user',JSON.stringify(d));setMessage('Profile updated successfully.');
    }catch(e){setMessage(e?.name==='AbortError'?'The update took too long. Please try again.':e.message)}finally{setSaving(false)}
  }

  async function readNotification(id){
    try{await request(`${API}/notifications/${id}/read`,{method:'PATCH',headers:{Authorization:`Bearer ${authToken()}`}})}catch{}
    setNotifications(n=>({...n,items:n.items.map(x=>x._id===id?{...x,readAt:new Date().toISOString()}:x),unread:Math.max(0,n.unread-(n.items.find(x=>x._id===id&&!x.readAt)?1:0))}))
  }

  if(busy && !profile?.email) return <main className="account-page page-width"><div className="account-loading"><div className="loading-pulse"></div><h2>Loading your account…</h2><p>Just a moment while we retrieve your profile.</p><button className="text-button" onClick={load}>Try again <ArrowRight size={16}/></button></div></main>;

  return <main className="account-page page-width">
    <div className="page-heading compact"><div><p className="eyebrow">MY GINNYS HUB</p><h1>My account</h1><p>Manage your details, orders and notifications.</p></div><button className="back-shop" onClick={()=>go('shop')}>Continue shopping <ArrowRight size={17}/></button></div>
    {error&&<div className="account-alert"><strong>We could not fully load your account.</strong><span>{error}</span><button onClick={load}>Retry</button></div>}
    <div className="account-layout">
      <aside className="account-nav"><button className={tab==='overview'?'active':''} onClick={()=>setTab('overview')}>Overview</button><button className={tab==='orders'?'active':''} onClick={()=>setTab('orders')}>My orders</button><button className={tab==='profile'?'active':''} onClick={()=>setTab('profile')}>Profile</button><button className={tab==='notifications'?'active':''} onClick={()=>setTab('notifications')}>Notifications {notifications.unread>0&&<span>{notifications.unread}</span>}</button><button onClick={()=>{localStorage.removeItem('gh-token');localStorage.removeItem('gh-user');setUser(null);go('home')}}>Sign out</button></aside>
      <section className="account-content">
        {tab==='overview'&&<><div className="account-welcome"><div><p className="eyebrow">HELLO</p><h2>{profile.name||'Welcome back'}</h2><p>{profile.email||''}</p></div><div className="account-stat"><b>{orders.length}</b><span>Orders placed</span></div></div><div className="account-cards"><button onClick={()=>setTab('orders')}><ShoppingBag/><b>My orders</b><span>Track your recent purchases</span></button><button onClick={()=>setTab('profile')}><UserRound/><b>Profile details</b><span>Keep your contact details current</span></button><button onClick={()=>setTab('notifications')}><BellIcon/><b>Notifications</b><span>{notifications.unread?`${notifications.unread} unread`:"You're all caught up"}</span></button></div></>}
        {tab==='profile'&&<form className="account-form" onSubmit={save}><div className="form-card"><div className="form-title"><span>01</span><div><h2>Profile details</h2><p>Update the details used for your orders.</p></div></div><label>Full name<input name="name" defaultValue={profile.name||''} required/></label><label>Email address<input value={profile.email||''} readOnly/></label><label>Phone / WhatsApp<input name="phone" defaultValue={profile.phone||''} placeholder="0550 000 000"/></label><button className="primary" disabled={saving}>{saving?'Saving…':'Save changes'}</button>{message&&<p className="form-note">{message}</p>}</div></form>}
        {tab==='orders'&&<div className="account-orders"><div className="account-section-head"><div><p className="eyebrow">PURCHASE HISTORY</p><h2>Your orders</h2></div></div>{!orders.length?<div className="empty-state"><ShoppingBag/><h3>No orders yet</h3><p>Your completed purchases will appear here.</p><button className="primary" onClick={()=>go('shop')}>Start shopping</button></div>:orders.map(o=><article className="account-order" key={o._id}><div><b>#{String(o._id).slice(-6).toUpperCase()}</b><span>{new Date(o.createdAt).toLocaleDateString()} · {o.items?.length||0} item(s)</span></div><div><strong>{money(o.total)}</strong><span className={`order-status status-${o.status}`}>{o.status}</span></div><details><summary>View items</summary><ul>{(o.items||[]).map((i,n)=><li key={n}>{i.quantity} × {i.name}<b>{money(i.price*i.quantity)}</b></li>)}</ul></details><a className="wa-order-link" href={`https://wa.me/${WHATSAPP}?text=${encodeURIComponent(`Hi Ginnys Hub, I'd like an update on order #${String(o._id).slice(-6).toUpperCase()}.`)}`} target="_blank" rel="noopener noreferrer">Message us about this order</a></article>)}</div>}
        {tab==='notifications'&&<div className="account-orders"><div className="account-section-head"><div><p className="eyebrow">UPDATES</p><h2>Notifications</h2></div></div>{!notifications.items.length?<div className="empty-state"><BellIcon/><h3>No notifications</h3><p>Order updates will appear here.</p></div>:notifications.items.map(n=><button className={`account-notification ${n.readAt?'read':'unread'}`} key={n._id} onClick={()=>readNotification(n._id)}><BellIcon/><span><b>{n.title}</b><small>{n.message}</small><em>{new Date(n.createdAt).toLocaleString()}</em></span></button>)}</div>}
      </section>
    </div>
  </main>;
}
function BellIcon(){return <span className="bell-icon"><span>•</span></span>}

function Checkout({ cart, subtotal, delivery, freeOver, shippingFee, total, setCart, go, notify, reload }) {
  const [placing, setPlacing] = useState(false);
  const [couponCode, setCouponCode] = useState('');
  const [coupon, setCoupon] = useState(null); // { code, discount }
  const [couponBusy, setCouponBusy] = useState(false);
  const [couponError, setCouponError] = useState('');

  async function applyCoupon() {
    const code = couponCode.trim();
    if (!code) return;
    setCouponBusy(true); setCouponError('');
    try {
      const r = await fetch(`${API}/coupons/${encodeURIComponent(code)}?subtotal=${subtotal}`);
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.message || 'That coupon code is not valid.');
      setCoupon({ code: d.code, discount: d.discount });
    } catch (err) { setCoupon(null); setCouponError(err.message || 'That coupon code is not valid.'); }
    finally { setCouponBusy(false); }
  }
  const removeCoupon = () => { setCoupon(null); setCouponCode(''); setCouponError(''); };

  const discount = coupon?.discount || 0;
  const discountedSubtotal = Math.max(0, subtotal - discount);
  const adjustedDelivery = discountedSubtotal <= 0 || discountedSubtotal >= freeOver ? 0 : shippingFee;
  const adjustedTotal = round2(discountedSubtotal + adjustedDelivery);

  async function placeOrder(e) {
    e.preventDefault(); setPlacing(true);
    const f = new FormData(e.currentTarget);
    const body = {
      customer: { name: f.get('name'), email: f.get('email'), phone: f.get('phone') },
      deliveryAddress: f.get('address'), paymentMethod: f.get('payment'), notes: f.get('notes'),
      items: cart.map(({ productId, quantity }) => ({ productId, quantity })),
      ...(coupon ? { couponCode: coupon.code } : {}),
    };
    try {
      const r = await fetch(`${API}/orders`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(authToken() ? { Authorization: `Bearer ${authToken()}` } : {}) }, body: JSON.stringify(body) });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).message || 'We could not place your order. Please try again.');
      setCart([]); reload(); notify('Order received. We will contact you shortly.', 4500); go('home');
    } catch (err) {
      notify(err instanceof TypeError ? 'Could not reach the shop. Check your connection and try again.' : err.message, 4500);
    } finally { setPlacing(false); }
  }
  if (!cart.length) return <main className="checkout-page page-width"><div className="empty-state"><div className="empty-icon"><Check /></div><h2>No items to check out</h2><button className="primary" onClick={() => go('shop')}>Browse products <ArrowRight size={17} /></button></div></main>;
  return <main className="checkout-page page-width"><div className="checkout-head"><div><p className="eyebrow">SECURE CHECKOUT</p><h1>Complete your order</h1><p>One simple step and we will confirm delivery with you.</p></div><div className="checkout-steps"><span className="done">1 <Check size={12} /></span><i /><span className="active">2</span><i /><span>3</span></div></div><div className="checkout-layout"><form className="checkout-form" onSubmit={placeOrder}><div className="form-card"><div className="form-title"><span>01</span><div><h2>Your details</h2><p>Where should we contact you?</p></div></div><div className="field-grid"><label>Full name<input name="name" placeholder="Your full name" required /></label><label>Phone / WhatsApp<input name="phone" placeholder="0550 000 000" required /></label></div><label>Email address<input name="email" type="email" placeholder="you@example.com" required /></label><label>Delivery address<textarea name="address" placeholder="House number, street, area, city" required /></label></div><div className="form-card"><div className="form-title"><span>02</span><div><h2>Payment</h2><p>Choose how you would like to pay.</p></div></div><div className="payment-options"><label><input type="radio" name="payment" value="Cash on Delivery" defaultChecked /><span><b>Cash on Delivery</b><small>Pay when your order arrives</small></span></label><label><input type="radio" name="payment" value="Mobile Money" /><span><b>Mobile Money</b><small>We will confirm payment details</small></span></label></div><label>Order note <textarea name="notes" placeholder="Optional note for your order" /></label></div><button className="primary wide place-order" disabled={placing}>{placing ? 'Placing order…' : <>Place order <ArrowRight size={17} /></>}</button></form><Summary subtotal={subtotal} delivery={adjustedDelivery} freeOver={freeOver} total={adjustedTotal} showCta={false} coupon={coupon} couponCode={couponCode} setCouponCode={setCouponCode} applyCoupon={applyCoupon} removeCoupon={removeCoupon} couponBusy={couponBusy} couponError={couponError} /></div></main>;
}

function Auth({ mode, go, setUser, notify }) {
  const [isSignup, setIsSignup] = useState(mode === 'signup');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => setIsSignup(mode === 'signup'), [mode]);

  async function submit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const f = new FormData(e.currentTarget);
    const payload = isSignup
      ? { name: f.get('name'), email: f.get('email'), password: f.get('password'), phone: f.get('phone') }
      : { email: f.get('email'), password: f.get('password') };
    const endpoint = isSignup ? `${API}/auth/register` : `${API}/auth/login`;
    try {
      const r = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.message || data.error || 'Something went wrong. Please try again.');
      const account = data.user || data.customer || { name: payload.name || payload.email.split('@')[0], email: payload.email };
      if (data.token) localStorage.setItem('gh-token', data.token);
      localStorage.setItem('gh-user', JSON.stringify(account));
      setUser(account);
      notify(isSignup ? 'Welcome to Ginnys Hub.' : 'Welcome back.');
      go('home');
    } catch (err) {
      setError(err.message || 'Unable to connect.');
    } finally { setLoading(false); }
  }

  const switchMode = next => { setError(''); setIsSignup(next === 'signup'); go(next); };
  return <main className="auth-page">
    <div className="auth-shell">
      <section className="auth-brand-panel">
        <div className="auth-brand-logo"><img src="/ginnys-logo.webp" alt="Ginnys Hub" width="260" height="131" /></div>
        <p className="eyebrow">WELCOME TO GINNYS HUB</p>
        <h1>Beauty that fits<br /><i>your routine.</i></h1>
        <p>Save your details, keep your shopping bag close and make your next hair order in a few simple clicks.</p>
        <div className="auth-points"><span><Check size={15} /> Quality hair essentials</span><span><Check size={15} /> Easy Ghana delivery</span><span><Check size={15} /> WhatsApp support</span></div>
      </section>
      <section className="auth-card">
        <div className="auth-tabs"><button className={!isSignup ? 'active' : ''} onClick={() => switchMode('signin')}>Sign in</button><button className={isSignup ? 'active' : ''} onClick={() => switchMode('signup')}>Create account</button></div>
        <div className="auth-heading"><span className="auth-icon">{isSignup ? <UserPlus size={19} /> : <LogIn size={19} />}</span><div><p className="eyebrow">{isSignup ? 'JOIN US' : 'WELCOME BACK'}</p><h2>{isSignup ? 'Create your account' : 'Sign in to Ginnys'}</h2><p>{isSignup ? 'Keep your details ready for faster checkout.' : 'Access your Ginnys Hub shopping account.'}</p></div></div>
        <form className="auth-form" onSubmit={submit}>
          {isSignup && <label>Full name<div className="input-wrap"><UserRound size={17} /><input name="name" placeholder="Your full name" required /></div></label>}
          {isSignup && <label>Phone / WhatsApp<div className="input-wrap"><Phone size={17} /><input name="phone" placeholder="0550 000 000" required /></div></label>}
          <label>Email address<div className="input-wrap"><Mail size={17} /><input name="email" type="email" placeholder="you@example.com" required /></div></label>
          <label>Password<div className="input-wrap"><LockKeyhole size={17} /><input name="password" type={showPassword ? 'text' : 'password'} placeholder="Enter your password" minLength="6" required /><button type="button" onClick={() => setShowPassword(!showPassword)} aria-label="Show password">{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></div></label>
          {!isSignup && <div className="auth-row"><label className="remember"><input type="checkbox" /> <span>Remember me</span></label><button type="button" className="forgot" onClick={() => notify('Password reset can be connected to the backend email service.')}>Forgot password?</button></div>}
          {error && <div className="auth-error">{error}</div>}
          <button className="primary wide auth-submit" disabled={loading}>{loading ? 'Please wait…' : isSignup ? <>Create account <ArrowRight size={17} /></> : <>Sign in <ArrowRight size={17} /></>}</button>
        </form>
        <p className="auth-switch">{isSignup ? 'Already have an account?' : 'New to Ginnys Hub?'} <button onClick={() => switchMode(isSignup ? 'signin' : 'signup')}>{isSignup ? 'Sign in' : 'Create an account'}</button></p>
        <div className="auth-secure"><LockKeyhole size={13} /> Your details are used only to manage your Ginnys Hub orders.</div>
      </section>
    </div>
  </main>;
}

const TRACK_STEPS = ['pending', 'confirmed', 'processing', 'shipped', 'delivered'];

function TrackOrder({ go }) {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [order, setOrder] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault(); setBusy(true); setError(''); setOrder(null);
    try {
      const r = await fetch(`${API}/orders/lookup?email=${encodeURIComponent(email.trim())}&code=${encodeURIComponent(code.trim())}`);
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.message || 'We could not find that order.');
      setOrder(d);
    } catch (err) { setError(err.message || 'Something went wrong. Please try again.'); }
    finally { setBusy(false); }
  }

  const orderCode = order ? String(order._id).slice(-6).toUpperCase() : '';
  const waText = `Hi Ginnys Hub, I'd like an update on order #${orderCode}.`;
  const stepIndex = order ? TRACK_STEPS.indexOf(order.status) : -1;

  return <main className="track-page page-width">
    <div className="page-heading compact"><div><p className="eyebrow">ORDER STATUS</p><h1>Track your order</h1><p>Enter the email and order number from your confirmation email.</p></div></div>
    <div className="track-layout">
      <form className="track-form" onSubmit={submit}>
        <label>Email address<input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="you@example.com" /></label>
        <label>Order number<input value={code} onChange={e => setCode(e.target.value.toUpperCase())} required placeholder="e.g. A1B2C3" maxLength={6} /></label>
        {error && <div className="auth-error" role="alert">{error}</div>}
        <button className="primary wide" disabled={busy}>{busy ? 'Looking…' : 'Track order'}</button>
      </form>

      {order && <div className="track-result">
        <div className="track-result-head">
          <div><b>#{orderCode}</b><span>Placed {new Date(order.createdAt).toLocaleDateString()}</span></div>
          <span className={`order-status status-${order.status}`}>{order.status}</span>
        </div>
        {order.status !== 'cancelled' && <ul className="track-steps">
          {TRACK_STEPS.map((s, i) => <li key={s} className={i <= stepIndex ? 'done' : ''}>{s}</li>)}
        </ul>}
        <ul className="track-items">{(order.items || []).map((i, n) => <li key={n}><span>{i.quantity} × {i.name}</span><b>{money(i.price * i.quantity)}</b></li>)}</ul>
        <div className="track-total"><span>Total</span><b>{money(order.total)}</b></div>
        <a className="secondary" href={`https://wa.me/${WHATSAPP}?text=${encodeURIComponent(waText)}`} target="_blank" rel="noopener noreferrer"><MessageCircle size={16} /> Message us about this order</a>
      </div>}
    </div>
  </main>;
}

function Footer({ go }) { return <footer><div className="footer-inner page-width"><div className="footer-main"><Link to="home" go={go} className="footer-logo"><img src="/ginnys-logo.webp" alt="Ginnys Hub" width="150" height="76" loading="lazy" decoding="async" /></Link><p>Hair & hair-care essentials for your next look.</p><a href={`https://wa.me/${WHATSAPP}`} className="footer-contact"><MessageCircle size={15} /> 0550196536</a></div><div><b>Shop</b><Link to="shop" go={go}>All products</Link><Link to="shop" go={go}>Mesh Hair</Link><Link to="shop" go={go}>Hair Care</Link></div><div><b>Help</b><a href={`https://wa.me/${WHATSAPP}`}>WhatsApp us</a><a href="tel:+233550196536">Call us</a><Link to="track" go={go}>Track my order</Link></div><div className="footer-bottom"><span>© 2026 Ginnys Hub</span><span>Quality hair. Simple shopping.</span></div></div></footer>; }

createRoot(document.getElementById('root')).render(<App />);
