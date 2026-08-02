/*
  用户内容状态字段样板。
  作用：说明收藏记录、播放历史、当前播放状态和恢复播放策略的字段结构。
*/
export const userContentStateExample = {
  user: {
    id: 'guest-user',
    name: '游客用户',
    role: 'guest',
    status: 'memory',
    message: '当前项目使用初始化数据，运行时只保存在内存中。'
  },
  favorites: {
    maxRecords: 100,
    records: [
      {
        sourceId: 'system-source-1',
        contentId: 'movie-001',
        favoriteKey: 'system-source-1::movie-001',
        contentKey: 'system-source-1::movie-001',
        favoritedAt: '2026-07-01T10:00:00.000Z',
        updatedAt: '2026-07-01T10:00:00.000Z'
      }
    ]
  },
  playHistory: {
    maxRecords: 100,
    records: [
      {
        sourceId: 'system-source-1',
        contentId: 'tv-001',
        type: 'tv',
        episodeId: 'tv-001-episode-003',
        episodeIndex: 3,
        historyKey: 'system-source-1::tv-001::tv-001-episode-003',
        contentKey: 'system-source-1::tv-001',
        firstPlayedAt: '2026-07-02T20:00:00.000Z',
        lastPlayedAt: '2026-07-02T21:00:00.000Z',
        playedSeconds: 492,
        durationSeconds: 2760,
        playStatus: 'played',
        playbackSourceId: '',
        updatedAt: '2026-07-02T21:00:00.000Z'
      }
    ]
  },
  currentPlaying: {
    sourceId: 'system-source-1',
    contentId: 'tv-001',
    type: 'tv',
    episodeId: 'tv-001-episode-003',
    episodeIndex: 3,
    playbackSourceId: 'line-001',
    playStatus: 'playing',
    startedAt: '2026-07-07T20:00:00.000Z',
    updatedAt: '2026-07-07T20:00:00.000Z'
  },
  resumePolicy: {
    nearStartThresholdSeconds: 5,
    nearEndThresholdSeconds: 30
  }
};
