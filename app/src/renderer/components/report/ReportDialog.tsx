import { useRef, useState } from 'react';
import { Check, Copy, FileText, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { ScrollArea } from '../ui/scroll-area';
import { Markdown } from '../ui/markdown';
import { useCopy } from '../../lib/useCopy';
import { generateReport } from '../../lib/api';

/** 一键生成周报按钮 + 弹窗（markdown 渲染 + 一键复制） */
export function ReportButton() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [markdown, setMarkdown] = useState('');
  const [failed, setFailed] = useState(false);
  const { copied, copy } = useCopy();
  const reqId = useRef(0);

  const openReport = async () => {
    const id = ++reqId.current;
    setOpen(true);
    setLoading(true);
    setFailed(false);
    setMarkdown('');
    try {
      const md = await generateReport();
      if (id !== reqId.current) return; // 旧请求作废，避免覆盖新结果
      setMarkdown(md);
    } catch {
      if (id !== reqId.current) return;
      setFailed(true);
      toast.error('周报生成失败，稍后再试');
    } finally {
      if (id === reqId.current) setLoading(false);
    }
  };

  const onCopy = async () => {
    if (!markdown) return;
    if (await copy(markdown)) toast.success('已复制到剪贴板');
    else toast.error('复制失败，请手动选择文本');
  };

  const onOpenChange = (next: boolean) => {
    if (!next) reqId.current += 1; // 关闭时作废在途请求
    setOpen(next);
  };

  return (
    <>
      <Button className="w-full" onClick={openReport}>
        <FileText className="size-4" /> 一键生成周报
      </Button>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl gap-3">
          <DialogHeader>
            <DialogTitle>本周周报</DialogTitle>
          </DialogHeader>
          {loading ? (
            <div className="flex h-40 items-center justify-center text-muted-foreground">
              <Loader2 className="size-5 animate-spin" />
            </div>
          ) : failed ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              生成失败，请稍后再试，或检查「设置」里的 LLM 配置。
            </p>
          ) : (
            <>
              <ScrollArea className="max-h-[60vh] rounded-lg border border-border-muted p-4">
                <Markdown>{markdown}</Markdown>
              </ScrollArea>
              <div className="flex justify-end">
                <Button variant="secondary" size="sm" onClick={onCopy} disabled={!markdown}>
                  {copied ? <Check className="size-4" /> : <Copy className="size-4" />} 复制
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
