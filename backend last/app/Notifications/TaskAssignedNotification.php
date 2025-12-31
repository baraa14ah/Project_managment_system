<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Notification;

class TaskAssignedNotification extends Notification
{
    
    use Queueable;

    protected $task;

    // نمرّر المهمة للـ Notification
    public function __construct($task)
    {
        $this->task = $task;
    }

    // نريد حفظ الإشعار في قاعدة البيانات فقط
    public function via($notifiable)
    {
        return ['database'];
    }

    // البيانات التي سيتم تخزينها في جدول notifications
    public function toDatabase($notifiable)
    {
        return [
            'title' => 'New Task Assigned',
            'message' => "You have been assigned a new task: {$this->task->title}",
            'task_id' => $this->task->id,
            'project_id' => $this->task->project_id,
        ];
    }
}
