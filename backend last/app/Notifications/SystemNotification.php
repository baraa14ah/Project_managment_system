<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Notification;

class SystemNotification extends Notification
{
    use Queueable;

    public function __construct(
        public string $type,
        public string $title,
        public ?string $body = null,
        public array $data = []
    ) {}

    public function via($notifiable): array
    {
        // Database notifications
        return ['database'];
    }

    public function toDatabase($notifiable): array
    {
        return [
            'type'  => $this->type,     // e.g. task.created, comment.created ...
            'title' => $this->title,    // short title
            'body'  => $this->body,     // optional details
            'data'  => $this->data,     // any extra payload (project_id, task_id, url...)
        ];
    }
}
