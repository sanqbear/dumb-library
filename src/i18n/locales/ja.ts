export default {
  common: {
    add: '追加',
    cancel: 'キャンセル',
    save: '保存',
    delete: '削除',
    close: '閉じる',
    remove: '削除',
    confirm: '確認',
    edit: '編集',
    apply: '適用',
    rescan: '再スキャン',
    change: '変更',
    select: '選択'
  },
  header: {
    searchPlaceholder: 'プログラムを検索...',
    addProgram: 'プログラム追加',
    addFromPC: 'PCから追加',
    addFromSteam: 'Steamから追加',
    gridView: 'グリッド表示',
    listView: 'リスト表示',
    darkMode: 'ダークモード',
    lightMode: 'ライトモード',
    language: '言語',
    filter: 'フィルター',
    provider: 'プロバイダー',
    allProviders: 'すべて',
    tags: 'タグ',
    selectTags: 'タグを選択',
    clearFilters: 'フィルターをクリア',
    sortRecent: '新しい順',
    sortOldest: '古い順',
    sortNameAsc: '名前 (昇順)',
    sortNameDesc: '名前 (降順)'
  },
  library: {
    emptyTitle: 'プログラムがまだありません',
    emptyAction: '「プログラム追加」ボタンから始めましょう',
    emptyFilteredTitle: '一致する結果がありません',
    emptyFilteredAction: 'フィルターを調整してみてください'
  },
  listView: {
    columnTitle: 'タイトル',
    columnProvider: 'プロバイダー',
    columnTags: 'タグ',
    columnActions: '操作'
  },
  cardMenu: {
    launch: '起動',
    edit: '編集',
    changeThumbnail: 'サムネイル変更',
    delete: '削除'
  },
  addDialog: {
    title: 'プログラム追加',
    titleLabel: 'タイトル',
    titlePlaceholder: 'プログラム名を入力',
    executablePath: '実行ファイルパス',
    executablePathPlaceholder: '実行ファイルを選択',
    tagsLabel: 'タグ',
    selectImage: 'ファイルから選択',
    imageUrl: '画像URL',
    fetchUrl: '取得',
    dropHere: 'ここにドラッグ',
    addedSuccess: 'プログラムを追加しました',
    addFailed: 'プログラム追加に失敗しました',
    onlyImages: '画像ファイルのみ対応しています',
    urlFetchFailed: 'URLから画像を取得できませんでした',
    imageReadFailed: '画像を読み込めませんでした'
  },
  editDialog: {
    title: 'プログラム編集',
    thumbnailLabel: 'サムネイル (600×900)',
    iconLabel: 'アイコン (256×256)',
    thumbnailCropTitle: 'サムネイルをクロップ (2:3)',
    iconCropTitle: 'アイコンをクロップ (1:1)',
    reextractFromExe: '.exeから再抽出',
    steamArtworkSelect: 'Steamアートワーク',
    steamCoverRestore: 'デフォルトカバーに戻す',
    steamCacheIcon: 'Steamキャッシュから',
    updatedSuccess: 'プログラムを更新しました',
    updateFailed: 'プログラム更新に失敗しました',
    deleteConfirmTitle: 'プログラムを削除',
    deleteConfirmMessage: '"{title}" を削除しますか? 元に戻せません。',
    deleted: '削除しました',
    deleteFailed: '削除に失敗しました',
    iconExtracted: 'アイコンを抽出しました',
    iconExtractFailed: 'アイコン抽出に失敗しました',
    steamCoverRedownloaded: 'Steamカバーを再ダウンロードしました',
    steamCoverFailed: 'Steamカバーの取得に失敗しました (AppIDまたはネットワークを確認)',
    steamCacheIconFound: 'Steamキャッシュからアイコンを取得しました',
    steamCacheIconNotFound: 'Steamキャッシュにアイコンが見つかりません'
  },
  steamDialog: {
    title: 'Steamから追加',
    installedTab: 'インストール済み',
    manualTab: 'AppIDで追加',
    searchPlaceholder: '名前で検索',
    noGamesFound: "インストール済みのSteamゲームが見つかりません。Steamがインストールされていないか、ライブラリを読めませんでした。'AppIDで追加' タブで手動で入力できます。",
    appIdLabel: 'AppID',
    appIdPlaceholder: '例: 730',
    nameLabel: '名前',
    namePlaceholder: 'ゲーム名',
    appIdHelp: 'AppIDはSteamストアURLで確認できます。',
    appIdExample: '例: store.steampowered.com/app/{example} → AppIDは {example}',
    countFormat: '{count} 件',
    filteredCountFormat: '{filtered} / {total}',
    addedSuccess: 'Steamゲームを追加しました',
    addedNGames: '{n} 件のゲームを追加しました',
    partialAdded: '{added}/{requested} 件のみ追加されました',
    someMissingThumb: '{added} 件追加。{missing} 件はカバー取得失敗。編集から「デフォルトカバーに戻す」で再試行できます。',
    addFailed: '追加失敗',
    previewTitle: 'プレビュー',
    previewTooltip: 'プレビュー: {name}'
  },
  cropDialog: {
    title: '画像クロップ',
    notReady: 'クロッパーの準備ができていません',
    noResult: 'クロップ結果を取得できませんでした',
    encodeFailed: '画像エンコードに失敗',
    processFailed: 'クロップ処理に失敗'
  },
  artworkDialog: {
    title: 'Steamアートワークを選択',
    libraryCover: 'Library Cover',
    libraryHero: 'Library Hero',
    header: 'Header',
    capsule: 'Capsule',
    logo: 'Logo',
    unavailable: 'アートワークなし',
    downloadFailed: '画像ダウンロードに失敗しました'
  },
  card: {
    launchSuccess: '{title} を起動中',
    launchFailed: 'プログラムの起動に失敗しました',
    thumbnailUpdated: 'サムネイルを更新しました',
    thumbnailUpdateFailed: 'サムネイル更新に失敗しました'
  },
  providers: {
    local: 'ローカル',
    steam: 'Steam'
  },
  window: {
    minimize: '最小化',
    maximize: '最大化',
    close: '閉じる'
  }
}
