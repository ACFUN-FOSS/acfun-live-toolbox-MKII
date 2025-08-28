import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

interface Note {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  tags?: string[];
}

export class NotebookService {
  private notesPath: string;
  private notes: Note[];

  constructor() {
    // 初始化笔记存储路径
    const userDataPath = app.getPath('userData');
    this.notesPath = path.join(userDataPath, 'notes.json');
    this.notes = this.loadNotes();
  }

  /**
   * 从文件加载笔记数据
   */
  private loadNotes(): Note[] {
    try {
      if (fs.existsSync(this.notesPath)) {
        const data = fs.readFileSync(this.notesPath, 'utf8');
        return JSON.parse(data) as Note[];
      }
      return [];
    } catch (error) {
      console.error('Failed to load notes:', error);
      return [];
    }
  }

  /**
   * 保存笔记数据到文件
   */
  private saveNotes(): void {
    try {
      // 确保目录存在
      const dir = path.dirname(this.notesPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      fs.writeFileSync(this.notesPath, JSON.stringify(this.notes, null, 2), 'utf8');
    } catch (error) {
      console.error('Failed to save notes:', error);
      throw new Error('无法保存笔记数据');
    }
  }

  /**
   * 获取所有笔记
   */
  getNotes(): Note[] {
    return [...this.notes].sort((a, b) => 
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  }

  /**
   * 根据ID获取笔记
   * @param noteId 笔记ID
   */
  getNoteById(noteId: string): Note | undefined {
    return this.notes.find(note => note.id === noteId);
  }

  /**
   * 保存笔记（新建或更新）
   * @param note 笔记对象
   */
  saveNote(note: Partial<Note>): Note {
    const now = new Date().toISOString();

    if (note.id) {
      // 更新现有笔记
      const index = this.notes.findIndex(n => n.id === note.id);
      if (index === -1) {
        throw new Error('笔记不存在');
      }

      const updatedNote: Note = {
        ...this.notes[index],
        ...note,
        updatedAt: now
      };

      this.notes[index] = updatedNote;
      this.saveNotes();
      return updatedNote;
    } else {
      // 创建新笔记
      const newNote: Note = {
        id: uuidv4(),
        title: note.title || '无标题笔记',
        content: note.content || '',
        createdAt: now,
        updatedAt: now,
        tags: note.tags || []
      };

      this.notes.unshift(newNote); // 添加到数组开头
      this.saveNotes();
      return newNote;
    }
  }

  /**
   * 删除笔记
   * @param noteId 笔记ID
   */
  deleteNote(noteId: string): void {
    const initialLength = this.notes.length;
    this.notes = this.notes.filter(note => note.id !== noteId);

    if (this.notes.length < initialLength) {
      this.saveNotes();
    } else {
      throw new Error('笔记不存在');
    }
  }

  /**
   * 根据标签筛选笔记
   * @param tag 标签名称
   */
  getNotesByTag(tag: string): Note[] {
    return this.notes.filter(note => note.tags?.includes(tag));
  }

  /**
   * 获取所有标签
   */
  getAllTags(): string[] {
    const tagsSet = new Set<string>();
    this.notes.forEach(note => {
      note.tags?.forEach(tag => tagsSet.add(tag));
    });
    return Array.from(tagsSet);
  }
}

export const notebookService = new NotebookService();