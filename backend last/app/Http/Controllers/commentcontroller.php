<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\Comment;
use App\Models\Project;
use App\Models\Task;
use Illuminate\Support\Facades\DB;
use App\Services\NotificationService;

class CommentController extends Controller
{
    protected NotificationService $notifications;

    public function __construct(NotificationService $notifications)
    {
        $this->notifications = $notifications;
    }

    private function roleName(Request $request): ?string
    {
        return $request->user()?->role?->name ?? ($request->user()?->role ?? null);
    }

    private function canAccessProject(Request $request, Project $project): bool
    {
        $u = $request->user();
        if (!$u) return false;

        $role = $this->roleName($request);

        // ✅ عضو مشروع؟ (لو عندك status accepted خلّيه — إذا ما عندك احذف where('status','accepted'))
        $isMemberQuery = DB::table('project_members')
            ->where('project_id', $project->id)
            ->where('student_id', $u->id);

        // إذا عندك عمود status
        try {
            $isMemberQuery->where('status', 'accepted');
        } catch (\Throwable $e) {
            // تجاهل إذا العمود غير موجود
        }

        $isMember = $isMemberQuery->exists();

        return $role === 'admin'
            || (int)$project->user_id === (int)$u->id
            || (int)$project->supervisor_id === (int)$u->id
            || $isMember;
    }

    private function canAccessTask(Request $request, Task $task): bool
    {
        $u = $request->user();
        if (!$u) return false;

        $role = $this->roleName($request);

        $project = $task->project()->first();
        if (!$project) return false;

        return $role === 'admin'
            || (int)$project->user_id === (int)$u->id
            || (int)$project->supervisor_id === (int)$u->id
            || (int)($task->assigned_to ?? 0) === (int)$u->id;
    }

    // ------------------ Project Comments ------------------
    public function storeProjectComment(Request $request, $projectId)
    {
        $request->validate([
            'comment' => 'required|string',
        ]);

        $project = Project::find($projectId);
        if (!$project) return response()->json(['message' => 'Project not found'], 404);

        if (!$this->canAccessProject($request, $project)) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $actor = $request->user();

        $comment = Comment::create([
            'project_id' => $projectId,
            'user_id'    => $actor->id,
            'comment'    => $request->comment,
        ]);

        // ✅ إرسال إشعار لمشاركي المشروع (مالك + مشرف + أعضاء) باستثناء صاحب الحدث
        $this->notifications->notifyProjectParticipants(
            projectId: (int)$projectId,
            actorUserId: (int)$actor->id,
            type: 'comment.project',
            title: 'تعليق جديد على المشروع',
            body: "{$actor->name} أضاف تعليقاً على مشروع: {$project->title}",
            data: [
                'project_id' => (int)$projectId,
                'comment_id' => (int)$comment->id,
            ]
        );

        return response()->json([
            'message' => 'Comment added successfully',
            'comment' => $comment->load('user:id,name'),
        ], 201);
    }

    public function projectComments(Request $request, $projectId)
    {
        $project = Project::find($projectId);
        if (!$project) return response()->json(['message' => 'Project not found'], 404);

        if (!$this->canAccessProject($request, $project)) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $comments = Comment::where('project_id', $projectId)
            ->with('user:id,name')
            ->orderBy('created_at', 'desc')
            ->get();

        return response()->json(['comments' => $comments]);
    }

    // ------------------ Task Comments ------------------
    public function storeTaskComment(Request $request, $taskId)
    {
        $request->validate([
            'comment' => 'required|string',
        ]);

        $task = Task::find($taskId);
        if (!$task) return response()->json(['message' => 'Task not found'], 404);

        if (!$this->canAccessTask($request, $task)) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $actor = $request->user();

        $comment = Comment::create([
            'task_id'  => $taskId,
            'user_id'  => $actor->id,
            'comment'  => $request->comment,
        ]);

        // ✅ إشعار لمشاركي مشروع المهمة
        $projectId = (int)($task->project_id ?? 0);
        if ($projectId) {
            $project = Project::find($projectId);

            $this->notifications->notifyProject(
                project: $project,
                type: 'comment_added',
                title: 'تعليق جديد',
                body: "{$request->user()->name} أضاف تعليقًا",
                data: [
                    'project_id' => $projectId,
                    'task_id' => (int)$taskId,
                    'comment_id' => (int)$comment->id,
                
                    // ✅ أهم سطر
                    'url' => "/dashboard/projects/{$projectId}",

                ]
                ,
                ignoreUserId: $request->user()->id
            );
            
        }

        return response()->json([
            'message' => 'Comment added successfully',
            'comment' => $comment->load('user:id,name'),
        ], 201);
    }

    public function taskComments(Request $request, $taskId)
    {
        $task = Task::find($taskId);
        if (!$task) return response()->json(['message' => 'Task not found'], 404);

        if (!$this->canAccessTask($request, $task)) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $comments = Comment::where('task_id', $taskId)
            ->with('user:id,name')
            ->orderBy('created_at', 'desc')
            ->get();

        return response()->json(['comments' => $comments]);
    }

    public function update(Request $request, $id)
    {
        $request->validate(['comment' => 'required|string']);

        $comment = Comment::find($id);
        if (!$comment) return response()->json(['message' => 'Comment not found'], 404);

        $u = $request->user();
        $role = $this->roleName($request);

        if ($role !== 'admin' && (int)$comment->user_id !== (int)$u->id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $comment->comment = $request->comment;
        $comment->save();

        return response()->json([
            'message' => 'Comment updated',
            'comment' => $comment->load('user:id,name'),
        ]);
    }

    public function delete(Request $request, $id)
    {
        $comment = Comment::find($id);
        if (!$comment) return response()->json(['message' => 'Comment not found'], 404);

        $u = $request->user();
        $role = $this->roleName($request);

        if ($role !== 'admin' && (int)$comment->user_id !== (int)$u->id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $comment->delete();

        return response()->json(['message' => 'Comment deleted']);
    }
}
