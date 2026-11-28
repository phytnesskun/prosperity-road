import { returnManifest, winterManifest } from './bay.ts';
import type { Past } from './types.ts';

export function bayBoard(
  chapter: number,
  past: Past,
  picks: readonly string[]
): { name: string; value: string }[] {
  if (chapter === 14) {
    const load = returnManifest({ past, picks });
    const cargo: string[] = [];
    if (load.oldCargo) cargo.push(load.oldGoods + ' ' + load.oldCargo + ' 箱');
    if (!load.landed && load.reeds) cargo.push('灯芯芦 ' + load.reeds + ' 捆');
    if (!load.landed && load.parcels) cargo.push('包裹 ' + load.parcels + ' 件');
    return [
      { name: '在船舱位', value: load.occupied + ' / 4' },
      { name: '空余舱位', value: load.free + ' 位' },
      { name: '当前舱货', value: cargo.join(' · ') || '空船' },
    ];
  }
  if (chapter === 17) {
    const manifest = winterManifest(picks);
    const cargo: string[] = [];
    if (manifest.cotton) cargo.push('棉货 ' + manifest.cotton + ' 位');
    if (manifest.people) cargo.push('街坊 ' + manifest.people + ' 人');
    if (manifest.timber) cargo.push('木料 ' + manifest.timber + ' 箱');
    if (manifest.free) cargo.push('空 ' + manifest.free + ' 位');
    if (manifest.transferred) cargo.push('另船代渡 ' + manifest.transferred + ' 人');
    if (manifest.waiting) cargo.push('岸上候船 ' + manifest.waiting + ' 人');
    return [
      { name: '冬班契纸', value: manifest.contract?.name ?? '待落印' },
      { name: '每班保底', value: manifest.contract ? manifest.guarantee + ' 枚' : '待议' },
      { name: '头班船单', value: manifest.contract ? cargo.join(' · ') : '尚未排班' },
      ...(picks[1] ? [{ name: '头班实收', value: manifest.cash + ' 枚' }] : []),
    ];
  }
  return [];
}
