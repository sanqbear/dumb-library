export default {
  common: {
    add: '添加',
    cancel: '取消',
    save: '保存',
    delete: '删除',
    close: '关闭',
    remove: '移除',
    confirm: '确认',
    edit: '编辑',
    apply: '应用',
    rescan: '重新扫描',
    change: '更改',
    select: '选择'
  },
  header: {
    searchPlaceholder: '搜索程序...',
    addProgram: '添加程序',
    addFromPC: '从 PC 添加',
    addFromSteam: '从 Steam 添加',
    gridView: '网格视图',
    listView: '列表视图',
    darkMode: '深色模式',
    lightMode: '浅色模式',
    language: '语言',
    filter: '筛选',
    provider: '来源',
    allProviders: '所有来源',
    tags: '标签',
    selectTags: '选择标签',
    clearFilters: '清除筛选',
    sortRecent: '最新',
    sortOldest: '最早',
    sortNameAsc: '名称 (A-Z)',
    sortNameDesc: '名称 (Z-A)'
  },
  library: {
    emptyTitle: '还没有程序',
    emptyAction: '点击"添加程序"按钮开始',
    emptyFilteredTitle: '没有匹配的结果',
    emptyFilteredAction: '请尝试调整筛选条件'
  },
  listView: {
    columnTitle: '标题',
    columnProvider: '来源',
    columnTags: '标签',
    columnActions: '操作'
  },
  cardMenu: {
    launch: '启动',
    edit: '编辑',
    changeThumbnail: '更改缩略图',
    delete: '删除'
  },
  addDialog: {
    title: '添加程序',
    titleLabel: '标题',
    titlePlaceholder: '输入程序名称',
    executablePath: '可执行文件路径',
    executablePathPlaceholder: '选择可执行文件',
    tagsLabel: '标签',
    selectImage: '从文件选择',
    imageUrl: '图片 URL',
    fetchUrl: '获取',
    dropHere: '拖放到此处',
    addedSuccess: '程序已添加',
    addFailed: '添加程序失败',
    onlyImages: '仅支持图片文件',
    urlFetchFailed: '从 URL 获取图片失败',
    imageReadFailed: '读取图片失败'
  },
  editDialog: {
    title: '编辑程序',
    thumbnailLabel: '缩略图 (600×900)',
    iconLabel: '图标 (256×256)',
    thumbnailCropTitle: '裁剪缩略图 (2:3)',
    iconCropTitle: '裁剪图标 (1:1)',
    reextractFromExe: '从 .exe 重新提取',
    steamArtworkSelect: 'Steam 美术资源',
    steamCoverRestore: '恢复默认封面',
    steamCacheIcon: '从 Steam 缓存',
    updatedSuccess: '程序已更新',
    updateFailed: '更新程序失败',
    deleteConfirmTitle: '删除程序',
    deleteConfirmMessage: '删除 "{title}"? 此操作无法撤销。',
    deleted: '已删除',
    deleteFailed: '删除失败',
    iconExtracted: '已提取图标',
    iconExtractFailed: '提取图标失败',
    steamCoverRedownloaded: 'Steam 封面已重新下载',
    steamCoverFailed: '获取 Steam 封面失败 (请检查 AppID 或网络)',
    steamCacheIconFound: '已从 Steam 缓存加载图标',
    steamCacheIconNotFound: 'Steam 缓存中未找到图标'
  },
  steamDialog: {
    title: '从 Steam 添加',
    installedTab: '已安装游戏',
    manualTab: '使用 AppID 添加',
    searchPlaceholder: '按名称搜索',
    noGamesFound: "未找到已安装的 Steam 游戏。Steam 可能未安装或无法读取库。可以在 '使用 AppID 添加' 标签页手动输入。",
    appIdLabel: 'AppID',
    appIdPlaceholder: '例: 730',
    nameLabel: '名称',
    namePlaceholder: '游戏名称',
    appIdHelp: 'AppID 可在 Steam 商店 URL 中查看。',
    appIdExample: '例: store.steampowered.com/app/{example} → AppID 为 {example}',
    countFormat: '{count} 个',
    filteredCountFormat: '{filtered} / {total}',
    addedSuccess: 'Steam 游戏已添加',
    addedNGames: '已添加 {n} 个游戏',
    partialAdded: '仅添加了 {added}/{requested} 个游戏',
    someMissingThumb: '已添加 {added} 个。{missing} 个未能获取封面。可在编辑中使用 "恢复默认封面" 重试。',
    addFailed: '添加失败',
    previewTitle: '预览',
    previewTooltip: '预览: {name}'
  },
  cropDialog: {
    title: '裁剪图片',
    notReady: '裁剪器未就绪',
    noResult: '未获取到裁剪结果',
    encodeFailed: '图片编码失败',
    processFailed: '裁剪处理失败'
  },
  artworkDialog: {
    title: '选择 Steam 美术资源',
    libraryCover: 'Library Cover',
    libraryHero: 'Library Hero',
    header: 'Header',
    capsule: 'Capsule',
    logo: 'Logo',
    unavailable: '无可用资源',
    downloadFailed: '图片下载失败'
  },
  card: {
    launchSuccess: '正在启动 {title}',
    launchFailed: '启动程序失败',
    thumbnailUpdated: '缩略图已更新',
    thumbnailUpdateFailed: '更新缩略图失败'
  },
  providers: {
    local: '本地',
    steam: 'Steam'
  },
  window: {
    minimize: '最小化',
    maximize: '最大化',
    close: '关闭'
  }
}
