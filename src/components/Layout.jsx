import NavHeader from './NavHeader.jsx';

/** 画面2〜10の共通レイアウト：ヘッダー＋本文＋下部アクションバー */
export function ScreenLayout({ title, subtitle, children, footer, narrow = false }) {
  return (
    <div className="min-h-screen bg-white">
      <NavHeader />
      <main className={`mx-auto w-full px-8 pt-10 pb-36 ${narrow ? 'max-w-[1000px]' : 'max-w-[1400px]'}`}>
        {title && (
          <div className="mb-8">
            <h1 className="page-title">{title}</h1>
            {subtitle && <p className="page-sub">{subtitle}</p>}
          </div>
        )}
        {children}
      </main>
      {footer && <FooterBar>{footer}</FooterBar>}
    </div>
  );
}

export function FooterBar({ children }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-black bg-white">
      <div className="mx-auto flex w-full max-w-[1400px] items-center justify-end gap-6 px-8 py-4">{children}</div>
    </div>
  );
}

export function ErrorBox({ message, onRetry }) {
  if (!message) return null;
  return (
    <div role="alert" className="my-6 border-2 border-black bg-white p-5">
      <p className="font-bold">エラーが発生しました</p>
      <p className="mt-1 text-[18px] text-[#333333] break-all">{message}</p>
      {onRetry && (
        <button id="error-retry" className="btn btn-secondary mt-4" onClick={onRetry}>
          もう一度試す
        </button>
      )}
    </div>
  );
}
