import Phaser from 'phaser';
import { getRuntimeServices } from '../../meta/RuntimeServices.ts';
import { BaseUiScene } from './BaseUiScene.ts';
import { NavigationController } from '../navigation/NavigationController.ts';
import { buildDailyViewModel, dailyCellState, type DailyDashboardViewModel } from '../daily/DailyViewModel.ts';
import { computeCalendarCellBounds, computeDailyLayout } from '../daily/DailyCalendarLayout.ts';
import { ActionCard } from '../components/ActionCard.ts';
import { IconButton } from '../components/IconButton.ts';
import { ModalShell } from '../components/ModalShell.ts';
import { PaperPanel } from '../components/PaperPanel.ts';
import type { ResolvedUiViewport } from '../layout/UiViewport.ts';
import type { UiRect } from '../layout/HomeLayout.ts';
import { UI_TOKENS } from '../style/UiTokens.ts';
import { UI_ICON_KEYS } from '../assets/UiAssets.ts';
import { formatActiveTime } from '../game/GameHudViewModel.ts';
import type { AppLanguage } from '../../i18n/Language.ts';
import { formatMoveCount, monthName, tr } from '../../i18n/Localization.ts';
import { productBridge } from '../bridge/TrifoldProductBridge.ts';

interface CalendarCell {
  readonly surface: Phaser.GameObjects.Graphics;
  readonly label: Phaser.GameObjects.Text;
  readonly zone: Phaser.GameObjects.Zone;
  readonly dateKey: string | null;
  readonly selectable: boolean;
}

function monthAnchor(dateKey: string): string {
  return `${dateKey.slice(0, 7)}-01`;
}

function shiftMonth(anchor: string, delta: number): string {
  const year = Number(anchor.slice(0, 4));
  const month = Number(anchor.slice(5, 7));
  const date = new Date(Date.UTC(year, month - 1 + delta, 1));
  return `${date.getUTCFullYear().toString().padStart(4, '0')}-${(date.getUTCMonth() + 1).toString().padStart(2, '0')}-01`;
}

function monthLabel(anchor: string, language: AppLanguage): string {
  const year = Number(anchor.slice(0, 4));
  const month = Number(anchor.slice(5, 7));
  return `${monthName(language, month)} ${year}`;
}

function monthCells(anchor: string): readonly (string | null)[] {
  const year = Number(anchor.slice(0, 4));
  const month = Number(anchor.slice(5, 7));
  const first = new Date(Date.UTC(year, month - 1, 1));
  const mondayOffset = (first.getUTCDay() + 6) % 7;
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const cells: Array<string | null> = Array.from({ length: 42 }, () => null);
  for (let day = 1; day <= days; day += 1) {
    cells[mondayOffset + day - 1] = `${year.toString().padStart(4, '0')}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
  }
  return cells;
}

function resultText(result: { readonly moves: number; readonly activeMs: number } | null, language: AppLanguage): string {
  return result ? `${formatMoveCount(language, result.moves)} · ${formatActiveTime(result.activeMs)}` : tr(language, 'daily.notCompleted');
}

export class DailyScene extends BaseUiScene {
  private navigation: NavigationController | null = null;
  private viewModel: DailyDashboardViewModel | null = null;
  private todayKey = '';
  private selectedDateKey = '';
  private visibleMonth = '';
  private homeButton: IconButton | null = null;
  private summaryPanel: PaperPanel | null = null;
  private calendarPanel: PaperPanel | null = null;
  private dailyAction: ActionCard | null = null;
  private title: Phaser.GameObjects.Text | null = null;
  private streakText: Phaser.GameObjects.Text | null = null;
  private resultTextObject: Phaser.GameObjects.Text | null = null;
  private monthText: Phaser.GameObjects.Text | null = null;
  private previousMonth: IconButton | null = null;
  private nextMonth: IconButton | null = null;
  private readonly cells: CalendarCell[] = [];
  private weekdays: Phaser.GameObjects.Text[] = [];
  private summaryIcon: Phaser.GameObjects.Image | null = null;
  private confirmShell: ModalShell | null = null;
  private confirmText: Phaser.GameObjects.Text | null = null;
  private confirmCancel: ActionCard | null = null;
  private confirmStart: ActionCard | null = null;

  constructor() {
    super('DailyScene');
  }

  create(): void {
    this.clearDailySceneReferences();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdownDailyScene, this);
    this.cameras.main.setBackgroundColor(UI_TOKENS.color.table);
    getRuntimeServices().analytics.track('daily_open');
    this.navigation = new NavigationController(this.scene);
    const product = productBridge.snapshot();
    this.todayKey = product.currentDailyId ?? new Date().toISOString().slice(0, 10);
    this.selectedDateKey = this.todayKey;
    this.visibleMonth = monthAnchor(this.todayKey);
    this.refreshViewModel();
    const language = productBridge.settingsSnapshot().language;
    const viewport = this.currentUiViewport();

    this.homeButton = new IconButton(this, viewport, { iconKey: UI_ICON_KEYS.back, enabled: true }, () => this.navigation?.home(), 20);
    this.summaryPanel = new PaperPanel(this, { depth: 10 });
    this.calendarPanel = new PaperPanel(this, { depth: 10 });
    this.dailyAction = new ActionCard(this, viewport, { title: tr(language, 'daily.playToday'), enabled: true, emphasis: 'highlight' }, () => this.pressSelectedDate(), 20);
    this.title = this.add.text(0, 0, 'Daily', { color: '#eadfc7', fontFamily: 'Georgia, serif', fontStyle: 'bold' }).setOrigin(0.5).setDepth(20);
    this.streakText = this.add.text(0, 0, '', { color: '#24302e', fontFamily: 'system-ui, sans-serif', align: 'center' }).setOrigin(0.5).setDepth(20);
    this.resultTextObject = this.add.text(0, 0, '', { color: '#64706a', fontFamily: 'system-ui, sans-serif', align: 'center', wordWrap: { width: 320 } }).setOrigin(0.5).setDepth(20);
    this.monthText = this.add.text(0, 0, monthLabel(this.visibleMonth, language), { color: '#24302e', fontFamily: 'Georgia, serif', fontStyle: 'bold' }).setOrigin(0.5).setDepth(20);
    this.weekdays = tr(language, 'daily.weekdays').split(',').map(day => this.add.text(0, 0, day, { fontFamily: 'Georgia, serif', color: '#655a43' }).setOrigin(0.5).setDepth(20));
    this.summaryIcon = this.add.image(0, 0, UI_ICON_KEYS.streak).setTint(UI_TOKENS.color.gold).setDepth(20);
    this.previousMonth = new IconButton(this, viewport, { iconKey: UI_ICON_KEYS.chevronLeft, enabled: true }, () => this.changeMonth(-1), 20);
    this.nextMonth = new IconButton(this, viewport, { iconKey: UI_ICON_KEYS.chevronRight, enabled: false }, () => this.changeMonth(1), 20);
    this.renderCalendarGrid(false);
    this.refreshSummary();
    this.bindResponsiveLayout();
  }

  protected layout(viewport: ResolvedUiViewport): void {
    if (!this.homeButton || !this.summaryPanel || !this.calendarPanel || !this.dailyAction) return;
    const bounds = computeDailyLayout(viewport);
    const css = viewport.minTouchTarget / 44;
    this.homeButton.setViewport(viewport);
    this.dailyAction.setViewport(viewport);
    this.previousMonth?.setViewport(viewport);
    this.nextMonth?.setViewport(viewport);
    this.homeButton.layout(bounds.home);
    this.summaryPanel.layout(bounds.summary);
    this.calendarPanel.layout(bounds.calendar);

    this.title?.setPosition(bounds.header.x + bounds.header.width / 2, bounds.header.y + bounds.header.height / 2)
      .setFontSize(Math.max(20, Math.min(36, bounds.header.height * 0.48)));

    const inner: UiRect = {
      x: bounds.summary.x + bounds.summary.width * 0.08,
      y: bounds.summary.y + bounds.summary.height * 0.08,
      width: bounds.summary.width * 0.84,
      height: bounds.summary.height * 0.84,
    };
    const emblem = Math.min(inner.height * 0.12, 64 * css);
    this.summaryIcon?.setDisplaySize(emblem, emblem).setPosition(inner.x + inner.width / 2, inner.y + inner.height * 0.10);
    this.streakText?.setPosition(inner.x + inner.width / 2, inner.y + inner.height * 0.25)
      .setFontSize(Math.max(13 * css, Math.min(23 * css, inner.height * 0.055)));
    this.resultTextObject?.setWordWrapWidth(inner.width * 0.9).setPosition(inner.x + inner.width / 2, inner.y + inner.height * 0.43)
      .setFontSize(Math.max(11 * css, Math.min(18 * css, inner.height * 0.043)));
    this.dailyAction.layout({ x: inner.x, y: inner.y + inner.height * 0.61, width: inner.width, height: inner.height * 0.20 });

    const navSize = Math.min(bounds.calendarHeader.height, Math.max(viewport.minTouchTarget, 56 * viewport.uiScale));
    this.previousMonth?.layout({ x: bounds.calendarHeader.x + bounds.calendarHeader.width * 0.04, y: bounds.calendarHeader.y + (bounds.calendarHeader.height - navSize) / 2, width: navSize, height: navSize });
    this.nextMonth?.layout({ x: bounds.calendarHeader.x + bounds.calendarHeader.width - bounds.calendarHeader.width * 0.04 - navSize, y: bounds.calendarHeader.y + (bounds.calendarHeader.height - navSize) / 2, width: navSize, height: navSize });
    this.monthText?.setPosition(bounds.calendarHeader.x + bounds.calendarHeader.width / 2, bounds.calendarHeader.y + bounds.calendarHeader.height / 2)
      .setFontSize(Math.max(14, Math.min(24, bounds.calendarHeader.height * 0.32)));

    const cellBounds = computeCalendarCellBounds(bounds.calendarGrid, 42);
    this.weekdays.forEach((text, index) => {
      const cell = cellBounds[index]!;
      text.setPosition(cell.x + cell.width / 2, bounds.calendarGrid.y - 12 * css).setFontSize(12 * css);
    });
    this.cells.forEach((cell, index) => this.layoutCell(cell, cellBounds[index] ?? bounds.calendarGrid, viewport));
    this.layoutConfirmation(viewport);
  }

  private clearDailySceneReferences(): void {
    this.navigation = null;
    this.viewModel = null;
    this.homeButton = null;
    this.summaryPanel = null;
    this.calendarPanel = null;
    this.dailyAction = null;
    this.title = null;
    this.streakText = null;
    this.resultTextObject = null;
    this.monthText = null;
    this.weekdays = [];
    this.summaryIcon = null;
    this.previousMonth = null;
    this.nextMonth = null;
    this.cells.length = 0;
    this.confirmShell = null;
    this.confirmText = null;
    this.confirmCancel = null;
    this.confirmStart = null;
  }

  private shutdownDailyScene(): void {
    this.destroyCalendarCells();
    this.clearDailySceneReferences();
  }

  private refreshViewModel(): void {
    const services = getRuntimeServices();
    const product = productBridge.snapshot();
    this.viewModel = buildDailyViewModel(product.state, product.activeDailyId, this.todayKey, services.catalog, productBridge.settingsSnapshot().language);
  }

  private requireViewModel(): DailyDashboardViewModel {
    if (!this.viewModel) throw new Error('Daily view model is not ready.');
    return this.viewModel;
  }

  private createCalendarCells(keys: readonly (string | null)[], vm: DailyDashboardViewModel): void {
    for (let index = 0; index < 42; index += 1) {
      const dateKey = keys[index] ?? null;
      const selectable = dateKey !== null && vm.archive.some((day) => day.dateKey === dateKey);
      const surface = this.add.graphics().setDepth(20);
      const label = this.add.text(0, 0, dateKey ? String(Number(dateKey.slice(8, 10))) : '', {
        color: '#24302e', fontFamily: 'system-ui, sans-serif', fontStyle: 'bold',
      }).setOrigin(0.5).setDepth(21);
      const zone = this.add.zone(0, 0, 1, 1).setOrigin(0).setDepth(22).setInteractive();
      const cell: CalendarCell = { surface, label, zone, dateKey, selectable };
      zone.on('pointerdown', () => {
        if (cell.selectable && cell.dateKey) this.selectDate(cell.dateKey);
      });
      this.cells.push(cell);
    }
  }

  private destroyCalendarCells(): void {
    for (const cell of this.cells) {
      cell.zone.removeAllListeners();
      cell.zone.destroy();
      cell.label.destroy();
      cell.surface.destroy();
    }
    this.cells.length = 0;
  }

  private renderCalendarGrid(requestLayout: boolean): void {
    const vm = this.requireViewModel();
    const keys = monthCells(this.visibleMonth);
    this.destroyCalendarCells();
    this.createCalendarCells(keys, vm);
    this.monthText?.setText(monthLabel(this.visibleMonth, productBridge.settingsSnapshot().language));
    const oldest = vm.archive.at(-1)?.dateKey ?? vm.todayKey;
    const previous = shiftMonth(this.visibleMonth, -1);
    const next = shiftMonth(this.visibleMonth, 1);
    this.previousMonth?.setState({ iconKey: UI_ICON_KEYS.chevronLeft, enabled: previous.slice(0, 7) >= oldest.slice(0, 7) });
    this.nextMonth?.setState({ iconKey: UI_ICON_KEYS.chevronRight, enabled: next.slice(0, 7) <= vm.todayKey.slice(0, 7) });
    if (requestLayout) this.requestUiLayout();
  }

  private layoutCell(cell: CalendarCell, bounds: UiRect, viewport: ResolvedUiViewport): void {
    const vm = this.requireViewModel();
    const state = cell.dateKey ? dailyCellState(vm, cell.dateKey) : 'outside-archive';
    const selected = cell.dateKey === this.selectedDateKey;
    const fill = selected ? UI_TOKENS.color.control : state === 'today' ? UI_TOKENS.color.paperPressed
      : state === 'completed-on-time' ? 0xb9cba8
      : state === 'completed-archive' ? 0xb9c4c9
      : UI_TOKENS.color.paper;
    const alpha = cell.dateKey ? (state === 'future' || state === 'outside-archive' ? 0.55 : 0.94) : 0;
    cell.surface.clear();
    if (cell.dateKey) {
      cell.surface.fillStyle(fill, alpha).fillRoundedRect(bounds.x, bounds.y, bounds.width, bounds.height, Math.max(4, bounds.height * 0.16));
      cell.surface.lineStyle(selected ? 3 : 1, selected ? UI_TOKENS.color.gold : UI_TOKENS.color.mutedInk, selected ? 1 : 0.35)
        .strokeRoundedRect(bounds.x, bounds.y, bounds.width, bounds.height, Math.max(4, bounds.height * 0.16));
    }
    cell.label.setColor(selected ? '#fff2d4' : '#24302e').setVisible(Boolean(cell.dateKey)).setAlpha(alpha).setPosition(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2)
      .setFontSize(Math.max(10 * viewport.minTouchTarget / 44, Math.min(18 * viewport.minTouchTarget / 44, bounds.height * 0.30)));
    const hitHeight = Math.max(bounds.height, viewport.minTouchTarget);
    cell.zone.setPosition(bounds.x, bounds.y - (hitHeight - bounds.height) / 2).setSize(bounds.width, hitHeight);
  }

  private selectDate(dateKey: string): void {
    const vm = this.requireViewModel();
    if (!vm.archive.some((day) => day.dateKey === dateKey)) return;
    this.selectedDateKey = dateKey;
    this.refreshSummary();
    this.renderCalendarGrid(true);
  }

  private refreshSummary(): void {
    const vm = this.requireViewModel();
    const day = vm.archive.find((item) => item.dateKey === this.selectedDateKey) ?? vm.archive[0];
    if (!day || !this.dailyAction) return;
    const language = productBridge.settingsSnapshot().language;
    const active = vm.activeDateKey === day.dateKey;
    const title = active ? tr(language, 'common.continue') : day.dateKey === vm.todayKey ? vm.today.ctaLabel : day.personalBest ? tr(language, 'common.replay') : tr(language, 'daily.playArchive');
    this.dailyAction.setState({ title, subtitle: day.dateKey, emphasis: 'highlight', enabled: true });
    this.streakText?.setText(tr(language, 'daily.streakSummary', { current: vm.currentStreak, best: vm.bestStreak }));
    const officialResult = day.officialResult;
    const personalBest = day.personalBest;
    const lines = [tr(language, 'daily.official', { result: resultText(officialResult, language) }), tr(language, 'daily.personal', { result: resultText(personalBest, language) })];
    this.resultTextObject?.setText(lines.join('\n'));
  }

  private pressSelectedDate(): void {
    const vm = this.requireViewModel();
    if (vm.activeDateKey === this.selectedDateKey) {
      productBridge.resumeGame();
      return;
    }
    if (vm.activeDateKey && vm.activeDateKey !== this.selectedDateKey) {
      this.confirmReplacement();
      return;
    }
    if (this.selectedDateKey !== vm.todayKey) {
      getRuntimeServices().analytics.track('daily_archive_open', { dateKey: this.selectedDateKey });
    }
    productBridge.startDaily(this.selectedDateKey);
  }

  private confirmReplacement(): void {
    if (this.confirmShell) return;
    const viewport = this.currentUiViewport();
    const language = productBridge.settingsSnapshot().language;
    this.confirmShell = new ModalShell(this, tr(language, 'daily.confirmTitle'), () => this.closeConfirmation(), 5000);
    this.confirmText = this.add.text(0, 0, tr(language, 'daily.confirmBody'), {
      color: '#64706a', fontFamily: 'system-ui, sans-serif', align: 'center', wordWrap: { width: viewport.width * 0.5 },
    }).setOrigin(0.5).setDepth(5002);
    this.confirmCancel = new ActionCard(this, viewport, { title: tr(language, 'common.cancel'), enabled: true }, () => this.closeConfirmation(), 5002);
    this.confirmStart = new ActionCard(this, viewport, { title: tr(language, 'common.start'), enabled: true, emphasis: 'highlight' }, () => {
      const dateKey = this.selectedDateKey;
      if (dateKey !== this.requireViewModel().todayKey) {
        getRuntimeServices().analytics.track('daily_archive_open', { dateKey });
      }
      this.closeConfirmation();
      productBridge.startDaily(dateKey);
    }, 5002);
    this.layoutConfirmation(viewport);
  }

  private closeConfirmation(): void {
    this.confirmShell?.destroy();
    this.confirmText?.destroy();
    this.confirmCancel?.destroy();
    this.confirmStart?.destroy();
    this.confirmShell = null;
    this.confirmText = null;
    this.confirmCancel = null;
    this.confirmStart = null;
  }

  private layoutConfirmation(viewport: ResolvedUiViewport): void {
    if (!this.confirmShell || !this.confirmText || !this.confirmCancel || !this.confirmStart) return;
    this.confirmCancel.setViewport(viewport);
    this.confirmStart.setViewport(viewport);
    const width = Math.min(viewport.width * 0.64, 680 * viewport.uiScale);
    const height = Math.min(viewport.height * 0.62, 300 * viewport.uiScale);
    const bounds = { x: (viewport.width - width) / 2, y: (viewport.height - height) / 2, width, height };
    this.confirmShell.layout(viewport.width, viewport.height, bounds);
    this.confirmText.setPosition(bounds.x + bounds.width / 2, bounds.y + bounds.height * 0.45).setWordWrapWidth(bounds.width * 0.8)
      .setFontSize(Math.max(12, Math.min(19, height * 0.06)));
    const gap = 10 * viewport.uiScale;
    const buttonWidth = (bounds.width * 0.80 - gap) / 2;
    const buttonHeight = Math.max(viewport.minTouchTarget, bounds.height * 0.18);
    const x = bounds.x + bounds.width * 0.10;
    const y = bounds.y + bounds.height - buttonHeight - bounds.height * 0.09;
    this.confirmCancel.layout({ x, y, width: buttonWidth, height: buttonHeight });
    this.confirmStart.layout({ x: x + buttonWidth + gap, y, width: buttonWidth, height: buttonHeight });
  }

  private changeMonth(delta: number): void {
    const next = shiftMonth(this.visibleMonth, delta);
    const vm = this.requireViewModel();
    const oldest = vm.archive.at(-1)?.dateKey ?? vm.todayKey;
    if (next.slice(0, 7) < oldest.slice(0, 7) || next.slice(0, 7) > vm.todayKey.slice(0, 7)) return;
    this.visibleMonth = next;
    this.renderCalendarGrid(true);
  }
}
