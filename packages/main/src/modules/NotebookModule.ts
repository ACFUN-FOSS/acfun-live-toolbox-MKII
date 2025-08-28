import { EventEmitter } from 'events';
import { existsSync, readdirSync, readFile, writeFile, unlink, mkdir } from 'fs/promises';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';

/**
 * 笔记接口定义
 */
interface Note {
  id: string;
  title: string;
  content: string;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

/**
 * 小本本功能模块
 * 负责笔记的创建、编辑、查询和删除管理
 */
export class NotebookModule extends EventEmitter {
  private notesDirectory: string;
  private notes: Map<string, Note>;

  constructor() {
    super();
    this.notesDirectory = join(__dirname, '../../data/notebooks');
    this.notes = new Map();
    this.initialize();
  }

  /**
   * 初始化小本本模块
   */
  private async initialize(): Promise<void> {
    // 确保笔记目录存在
    await this.ensureDirectoryExists(this.notesDirectory);
    // 加载现有笔记
    await this.loadNotes();
  }

  /**
   * 确保目录存在
   */
  private async ensureDirectoryExists(path: string): Promise<void> {
    if (!await existsSync(path)) {
      await mkdir(path, { recursive: true });
    }
  }

  /**
   * 加载所有笔记
   */
  private async loadNotes(): Promise<void> {
    try {
      const files = await readdirSync(this.notesDirectory);
      const noteFiles = files.filter(file => file.endsWith('.json'));

      for (const file of noteFiles) {
        const filePath = join(this.notesDirectory, file);
        const fileContent = await readFile(filePath, 'utf-8');
        const note: Note = JSON.parse(fileContent);

        // 转换日期字符串为Date对象
        note.createdAt = new Date(note.createdAt);
        note.updatedAt = new Date(note.updatedAt);

        this.notes.set(note.id, note);
      }

      this.emit('notesLoaded', this.getNotes());
    } catch (error) {
      console.error('Failed to load notes:', error);
    }
  }

  /**
   * 创建新笔记
   */
  public async createNote(noteData: Omit<Note, 'id' | 'createdAt' | 'updatedAt'>): Promise<Note> {
    const note: Note = {
      id: uuidv4(),
      ...noteData,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // 保存笔记到文件
    await this.saveNoteToFile(note);

    // 添加到内存存储
    this.notes.set(note.id, note);

    // 触发事件
    this.emit('noteCreated', note);

    return note;
  }

  /**
   * 保存笔记到文件
   */
  private async saveNoteToFile(note: Note): Promise<void> {
    const filePath = join(this.notesDirectory, `${note.id}.json`);
    await writeFile(filePath, JSON.stringify(note, null, 2), 'utf-8');
  }

  /**
   * 获取所有笔记
   */
  public getNotes(): Note[] {
    return Array.from(this.notes.values()).sort((a, b) => 
      b.updatedAt.getTime() - a.updatedAt.getTime()
    );
  }

  /**
   * 根据ID获取笔记
   */
  public getNoteById(id: string): Note | undefined {
    return this.notes.get(id);
  }

  /**
   * 更新笔记
   */
  public async updateNote(id: string, updates: Partial<Omit<Note, 'id' | 'createdAt'>>): Promise<Note | null> {
    const existingNote = this.notes.get(id);
    if (!existingNote) {
      return null;
    }

    const updatedNote: Note = {
      ...existingNote,
      ...updates,
      updatedAt: new Date()
    };

    // 保存更新后的笔记
    await this.saveNoteToFile(updatedNote);

    // 更新内存存储
    this.notes.set(id, updatedNote);

    // 触发事件
    this.emit('noteUpdated', updatedNote);

    return updatedNote;
  }

  /**
   * 删除笔记
   */
  public async deleteNote(id: string): Promise<boolean> {
    const existingNote = this.notes.get(id);
    if (!existingNote) {
      return false;
    }

    // 删除文件
    const filePath = join(this.notesDirectory, `${id}.json`);
    await unlink(filePath);

    // 从内存中移除
    this.notes.delete(id);

    // 触发事件
    this.emit('noteDeleted', id);

    return true;
  }

  /**
   * 根据标签搜索笔记
   */
  public searchNotesByTag(tag: string): Note[] {
    return Array.from(this.notes.values())
      .filter(note => note.tags.includes(tag))
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  }

  /**
   * 根据关键词搜索笔记
   */
  public searchNotesByKeyword(keyword: string): Note[] {
    const lowerKeyword = keyword.toLowerCase();
    return Array.from(this.notes.values())
      .filter(note => 
        note.title.toLowerCase().includes(lowerKeyword) || 
        note.content.toLowerCase().includes(lowerKeyword)
      )
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  }
}

export default new NotebookModule();