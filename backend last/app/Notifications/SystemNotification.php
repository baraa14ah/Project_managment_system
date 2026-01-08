<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Notification;

class SystemNotification extends Notification
{
    use Queueable;

    protected string $type;
    protected string $title;
    protected string $body;
    protected array $data;

    public function __construct(
        string $type,
        string $title,
        string $body,
        array $data = []
    ) {
        $this->type  = $type;
        $this->title = $title;
        $this->body  = $body;
        $this->data  = $data;
    }

    /**
     * القنوات المستخدمة
     */
    public function via($notifiable): array
    {
        return ['database'];
    }

    /**
     * البيانات المخزنة في جدول notifications
     */
    public function toDatabase($notifiable): array
    {
        // ✅ حل جذري:
        // إذا url موجود داخل data أو داخل data[data]
        // نرفعه دائمًا للمستوى الأعلى
        $url = $this->data['url']
            ?? ($this->data['data']['url'] ?? null);

        return [
            'type'  => $this->type,
            'title' => $this->title,
            'body'  => $this->body,

            // data نظيفة ومضمونة
            'data'  => array_merge(
                $this->data,
                $url ? ['url' => $url] : []
            ),
        ];
    }
}
