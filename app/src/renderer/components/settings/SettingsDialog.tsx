import { useEffect, useRef, useState } from 'react';
import { CircleCheck, CircleX, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { ONEAPI_TOKEN_URL } from '@shared/config';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Switch } from '../ui/switch';
import { Separator } from '../ui/separator';
import { useConfigStore } from '../../store/useConfigStore';
import { testProvider } from '../../lib/api';

type TestStatus = 'idle' | 'testing' | 'success' | 'error';

export function SettingsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const config = useConfigStore((s) => s.config);
  const update = useConfigStore((s) => s.update);

  const [baseURL, setBaseURL] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('');
  const [nudgeEnabled, setNudgeEnabled] = useState(true);
  const [testStatus, setTestStatus] = useState<TestStatus>('idle');
  const [saving, setSaving] = useState(false);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 仅在打开瞬间用最新 config 填表一次；不依赖 config，避免测试/保存触发的 store 更新打回表单
  useEffect(() => {
    if (!open) return;
    const current = useConfigStore.getState().config;
    if (!current) return;
    setBaseURL(current.llm.baseURL);
    setApiKey(current.llm.apiKey);
    setModel(current.llm.model);
    setNudgeEnabled(current.nudge.enabled);
    setTestStatus('idle');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => () => {
    if (resetTimer.current) clearTimeout(resetTimer.current);
  }, []);

  const scheduleStatusReset = () => {
    if (resetTimer.current) clearTimeout(resetTimer.current);
    resetTimer.current = setTimeout(() => setTestStatus('idle'), 3000);
  };

  const save = async () => {
    if (!config) return;
    setSaving(true);
    try {
      await update({
        llm: { baseURL, apiKey, model },
        nudge: { enabled: nudgeEnabled },
      });
      toast.success('已保存');
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '保存失败');
    } finally {
      setSaving(false);
    }
  };

  // 测试连接：用当前表单值，不落盘（取消按钮可放心回退）
  const runTest = async () => {
    setTestStatus('testing');
    try {
      const message = await testProvider({ baseURL, apiKey, model });
      setTestStatus('success');
      toast.success(message || '连接成功');
    } catch (error) {
      setTestStatus('error');
      toast.error(error instanceof Error ? error.message : '连接失败');
    }
    scheduleStatusReset();
  };

  const noKey = !apiKey.trim();
  const canSave = !!config && !saving && !!baseURL.trim() && !!model.trim() && !noKey;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md gap-4">
        <DialogHeader>
          <DialogTitle>设置</DialogTitle>
          <DialogDescription>
            配置 LLM provider 与主动提醒。apiKey 仅保存在本地，绝不上传。
          </DialogDescription>
        </DialogHeader>

        {noKey && (
          <div className="rounded-lg bg-warning/10 px-3 py-2 text-xs text-warning-foreground">
            未配置 apiKey。发送消息前需要先填写真实 LLM 配置，搭子会用真实模型完成归因与更新看板。
          </div>
        )}

        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="baseURL">baseURL</Label>
            <Input
              id="baseURL"
              value={baseURL}
              onChange={(e) => setBaseURL(e.target.value)}
              placeholder="https://..."
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="apiKey">apiKey</Label>
            <Input
              id="apiKey"
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-..."
            />
            <p className="text-xs text-muted-foreground">
              去{' '}
              <a
                className="text-brand underline underline-offset-2"
                href={ONEAPI_TOKEN_URL}
                target="_blank"
                rel="noreferrer noopener"
              >
                {ONEAPI_TOKEN_URL}
              </a>{' '}
              获取 token。
            </p>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="model">model</Label>
            <Input
              id="model"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="ernie-3.5-8k"
            />
          </div>
          <div>
            <Button
              variant="secondary"
              size="sm"
              onClick={runTest}
              disabled={testStatus === 'testing' || noKey || !baseURL.trim() || !model.trim()}
            >
              {testStatus === 'testing' && <Loader2 className="size-4 animate-spin" />}
              {testStatus === 'success' && <CircleCheck className="size-4 text-success" />}
              {testStatus === 'error' && <CircleX className="size-4 text-destructive" />}
              测试连接
            </Button>
          </div>
        </div>

        <Separator />

        <div className="flex items-center justify-between">
          <div>
            <Label>主动提醒</Label>
            <p className="text-xs text-muted-foreground">傍晚 / 停滞 / 周五的轻量系统通知</p>
          </div>
          <Switch checked={nudgeEnabled} onCheckedChange={setNudgeEnabled} />
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={save} disabled={!canSave}>
            保存
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
