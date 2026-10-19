// Google の店検索の結果を地図なしで出すときの帰属表示（Places API ポリシー、ADR 0011）。
// 公式ロゴ（白、無加工、縦横比そのまま、高さ 16〜19px）を、背景が単色の場所に出す。public/google-maps-logo.svg は公式配布物。
export function GoogleAttribution() {
  return (
    <div className="flex justify-end pt-2 pr-2.5 pb-1 pl-2.5">
      {/* eslint-disable-next-line @next/next/no-img-element -- 公式ロゴを無加工で出す静的ファイル */}
      <img src="/google-maps-logo.svg" alt="Google Maps" width={98} height={18} className="h-[18px] w-auto" />
    </div>
  );
}
