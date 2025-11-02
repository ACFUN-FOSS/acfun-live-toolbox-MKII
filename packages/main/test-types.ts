import type { DanmuMessage, Comment, Gift, Like } from 'acfunlive-http-api';

// 测试类型是否可用
const test: DanmuMessage = {} as any;
const comment: Comment = {} as any;
const gift: Gift = {} as any;
const like: Like = {} as any;

console.log('Types are available');