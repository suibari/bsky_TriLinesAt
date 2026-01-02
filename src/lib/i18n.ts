import { writable, derived } from 'svelte/store';

export type Locale = 'en' | 'ja';

export const translations = {
  en: {
    "app.title": "TriLinesAt",
    "app.tagline": "Five minutes before bed, three lines of journaling, everyone's daily record.",
    "app.connect": `This social app uses the "Three Good Things" method, which encourages a more positive outlook by recording three good things before going to bed. Log in as Bluesky and let's paint a positive blue-sky together.`,
    "auth.signin": "Sign in with Bluesky",
    "auth.signout": "Sign Out",
    "auth.handle_prompt": "Enter your Bluesky handle (e.g. user.bsky.social):",
    "feed.following": "Following",
    "feed.global": "Global",
    "feed.no_entries": "No entries found.",
    "feed.no_entries_hint": "Try following more people or writing your first diary!",
    "feed.diary_entries": "Diary Entries",
    "editor.title": "New Diary Entry",
    "editor.line1": "Line 1",
    "editor.line2": "Line 2",
    "editor.line3": "Line 3",
    "editor.placeholder": "Write one good thing in one line",
    "editor.share_bluesky": "Share to Bluesky",
    "editor.submit": "Create Diary",
    "editor.submitting": "Creating...",
    "editor.cancel": "Cancel",
    "card.view_on_bsky": "View on Bluesky",
    "card.delete": "Delete Entry",
    "card.delete_confirm": "Are you sure you want to delete this diary entry?",
    "card.delete_failed": "Failed to delete entry: ",
    "card.action_failed": "Action failed. Constellation indexing may be delayed.",
    "user.loading": "Loading...",
    "user.not_found": "User not found or error loading profile.",
    "user.thats_you": "That's You",
    "entry.not_found": "Diary entry not found.",
    "entry.back": "Back",
    "share.template": "My 3-Line Diary for today!",
    "feed.ranking": "Ranking",
    "ranking.total": "Total Days",
    "ranking.streak": "Current Streak",
    "ranking.posts": "posts",
    "ranking.days": "days",
  },
  ja: {
    "app.title": "TriLines",
    "app.tagline": "寝る前の5分、3行で綴る、みんなの毎日の記録",
    "app.connect": `寝る前に3つ、よかったことを記録することで、考え方が前向きになる"Three Good Things"メソッドのソーシャルアプリです。Blueskyでログインして、ポジティブな青空を描こう`,
    "auth.signin": "Blueskyでログイン",
    "auth.signout": "ログアウト",
    "auth.handle_prompt": "Blueskyのハンドル名を入力してください (例: user.bsky.social)",
    "feed.following": "フォロー中",
    "feed.global": "グローバル",
    "feed.ranking": "ランキング",
    "feed.no_entries": "まだ日記がありません",
    "feed.no_entries_hint": "最初の日記を書いてみましょう！",
    "feed.diary_entries": "過去の日記",
    "editor.title": "新しい日記",
    "editor.line1": "1行目",
    "editor.line2": "2行目",
    "editor.line3": "3行目",
    "editor.placeholder": "よかったことを1行で",
    "editor.share_bluesky": "Blueskyにシェア",
    "editor.submit": "日記を書く",
    "editor.submitting": "送信中...",
    "editor.cancel": "キャンセル",
    "card.view_on_bsky": "Blueskyで見る",
    "card.delete": "日記を削除",
    "card.delete_confirm": "この日記を削除してよろしいですか？",
    "card.delete_failed": "削除に失敗しました: ",
    "card.action_failed": "操作に失敗しました。Constellationの反映に時間がかかっている可能性があります。",
    "user.loading": "読み込み中...",
    "user.not_found": "ユーザーが見つかりません",
    "user.thats_you": "あなたです",
    "entry.not_found": "日記が見つかりませんでした。",
    "entry.back": "戻る",
    "share.template": "今日の三行日記を投稿しました!",
    "ranking.total": "累計投稿日数",
    "ranking.streak": "連続投稿日数",
    "ranking.posts": "投稿",
    "ranking.days": "日",
  }
};

const initialLocale = (typeof localStorage !== 'undefined' && localStorage.getItem('locale') as Locale) ||
  (typeof navigator !== 'undefined' && navigator.language.startsWith('ja') ? 'ja' : 'en');

export const locale = writable<Locale>(initialLocale);

locale.subscribe((value) => {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('locale', value);
  }
});

export const t = derived(locale, ($locale) => {
  return (key: keyof typeof translations.en) => {
    return translations[$locale][key] || translations['en'][key] || key;
  };
});
