<?php

namespace App\Http\Controllers;

use App\Models\Task;
use App\Models\Project;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use App\Services\NotificationService;

class TaskController extends Controller
{
    protected NotificationService $notifications;

    public function __construct(NotificationService $notifications)
    {
        $this->notifications = $notifications;
    }

    private function roleName($user): string
    {
        return $user->role?->name ?? (string)($user->role ?? '');
    }

    private function canAccessProject($user, Project $project): bool
    {
        if (!$user) return false;

        $role = $this->roleName($user);

        if ($role === 'admin') return true;
        if ((int)$project->user_id === (int)$user->id) return true;
        if ((int)$project->supervisor_id === (int)$user->id) return true;

        return DB::table('project_members')
            ->where('project_id', $project->id)
            ->where('student_id', $user->id)
            ->exists();
    }

    /**
     * =========================
     * إنشاء مهمة جديدة
     * =========================
     */
    public function create(Request $request)
    {
        $request->validate([
            'project_id' => 'required|integer|exists:projects,id',
            'title' => 'required|string|max:255',
            'description' => 'nullable|string',
            'deadline' => 'nullable|date',
        ]);

        $user = $request->user();
        $project = Project::find($request->project_id);

        if (!$this->canAccessProject($user, $project)) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $task = Task::create([
            'project_id' => $project->id,
            'title' => $request->title,
            'description' => $request->description,
            'deadline' => $request->deadline,
            'status' => 'pending',
            'created_by' => $user->id,
        ]);

        // ✅ إشعار عند إضافة مهمة
        $this->notifications->notifyProjectParticipants(
            projectId: (int)$project->id,
            actorUserId: (int)$user->id,
            type: 'task.created',
            title: 'مهمة جديدة',
            body: "{$user->name} أضاف مهمة جديدة: {$task->title}",
            data: [
                'project_id' => (int)$project->id,
                'task_id' => (int)$task->id,
            ]
        );

        return response()->json([
            'message' => 'Task created successfully',
            'task' => $task,
        ], 201);
    }

    /**
     * =========================
     * مهام مشروع
     * =========================
     */
    public function getProjectTasks(Request $request, $projectId)
    {
        $project = Project::find($projectId);
        if (!$project) return response()->json(['message' => 'Project not found'], 404);

        if (!$this->canAccessProject($request->user(), $project)) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $tasks = Task::where('project_id', $projectId)
            ->orderBy('created_at', 'desc')
            ->get();

        return response()->json(['tasks' => $tasks]);
    }

    /**
     * =========================
     * تحديث مهمة (خاصة الحالة)
     * =========================
     */
    public function update(Request $request, $id)
    {
        $task = Task::find($id);
        if (!$task) return response()->json(['message' => 'Task not found'], 404);

        $project = Project::find($task->project_id);
        if (!$project) return response()->json(['message' => 'Project not found'], 404);

        if (!$this->canAccessProject($request->user(), $project)) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $oldStatus = $task->status;

        $request->validate([
            'title' => 'sometimes|string|max:255',
            'description' => 'nullable|string',
            'deadline' => 'nullable|date',
            'status' => 'sometimes|in:pending,in_progress,completed',
        ]);

        $task->update($request->only(['title', 'description', 'deadline', 'status']));

        // ✅ إشعار عند تغيير الحالة فقط
        if ($request->has('status') && $oldStatus !== $task->status) {
            $user = $request->user();

            $this->notifications->notifyProjectParticipants(
                projectId: (int)$project->id,
                actorUserId: (int)$user->id,
                type: 'task.status_changed',
                title: 'تحديث حالة مهمة',
                body: "{$user->name} غيّر حالة المهمة '{$task->title}' إلى {$task->status}",
                data: [
                    'project_id' => (int)$project->id,
                    'task_id' => (int)$task->id,
                    'old_status' => $oldStatus,
                    'new_status' => $task->status,
                ]
            );
        }

        return response()->json([
            'message' => 'Task updated successfully',
            'task' => $task,
        ]);
    }

    /**
     * =========================
     * حذف مهمة
     * =========================
     */
    public function delete(Request $request, $id)
    {
        $task = Task::find($id);
        if (!$task) return response()->json(['message' => 'Task not found'], 404);

        $project = Project::find($task->project_id);
        if (!$project) return response()->json(['message' => 'Project not found'], 404);

        $role = $this->roleName($request->user());

        if (
            $role !== 'admin' &&
            (int)$project->user_id !== (int)$request->user()->id
        ) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $task->delete();

        return response()->json(['message' => 'Task deleted successfully']);
    }
}
