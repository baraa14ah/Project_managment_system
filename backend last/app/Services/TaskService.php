<?php

namespace App\Services;

use App\Models\Task;
use App\Repositories\TaskRepository;
use App\Models\Project;

class TaskService
{protected $tasks;

    public function __construct(TaskRepository $tasks)
    {
        $this->tasks = $tasks;
    }

    public function create($request, $projectId)
    {
        // تأكد أن المشروع موجود
        $project = Project::find($projectId);
        if (!$project) {
            return null;
        }

        // بيانات المهمة
        $data = [
            'title' => $request->title,
            'description' => $request->description,
            'deadline' => $request->deadline,
            'status' => 'pending',
            'assigned_to' => $request->assigned_to,
            'project_id' => $projectId,
        ];

        return $this->tasks->create($data);
    }

    public function list($projectId)
    {
        return $this->tasks->getByProjectId($projectId);
    }

    public function update($request, $taskId)
    {
        $task = $this->tasks->find($taskId);

        if (!$task) {
            return null;
        }

        $user = $request->user();
        $isAdmin = $user->role->name === 'admin';

        // الطالب لا يعدّل إلا لو كانت مهمته
        if (!$isAdmin && $task->assigned_to !== $user->id) {
            return 'unauthorized';
        }

        $data = [
            'title' => $request->title ?? $task->title,
            'description' => $request->description ?? $task->description,
            'deadline' => $request->deadline ?? $task->deadline,
            'status' => $request->status ?? $task->status,
            'assigned_to' => $request->assigned_to ?? $task->assigned_to,
        ];

        return $this->tasks->update($task, $data);
    }

    public function delete($request, $taskId)
    {
        $task = $this->tasks->find($taskId);

        if (!$task) {
            return null;
        }

        $user = $request->user();
        $isAdmin = $user->role->name === 'admin';

        // الطالب لا يحذف إلا لو كانت مهمته
        if (!$isAdmin && $task->assigned_to !== $user->id) {
            return 'unauthorized';
        }

        return $this->tasks->delete($task);
    }
}
