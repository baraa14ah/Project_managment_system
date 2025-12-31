<?php

namespace App\Services;

use App\Models\Project;
use App\Models\User;
use App\Notifications\SystemNotification;
use Illuminate\Notifications\DatabaseNotification;
use Illuminate\Support\Facades\DB;

class NotificationService
{
    // ----------------------------
    // Read / Manage
    // ----------------------------
    private function baseQuery(int $userId)
    {
        return DatabaseNotification::query()
            ->where('notifiable_id', $userId)
            ->where('notifiable_type', User::class);
    }

    public function getAll(int $userId)
    {
        $items = $this->baseQuery($userId)
            ->orderByDesc('created_at')
            ->paginate(20);

        return [
            'notifications' => $items->items(),
            'meta' => [
                'current_page' => $items->currentPage(),
                'last_page' => $items->lastPage(),
                'total' => $items->total(),
            ],
            'unread_count' => $this->unreadCount($userId),
        ];
    }

    public function getUnread(int $userId)
    {
        $items = $this->baseQuery($userId)
            ->whereNull('read_at')
            ->orderByDesc('created_at')
            ->get();

        return [
            'notifications' => $items,
            'unread_count' => $items->count(),
        ];
    }

    public function unreadCount(int $userId): int
    {
        return (int) $this->baseQuery($userId)->whereNull('read_at')->count();
    }

    public function markAsRead(string $id, int $userId)
    {
        $n = $this->baseQuery($userId)->where('id', $id)->first();
        if (!$n) return ['status' => 404, 'error' => 'Notification not found'];

        $n->markAsRead();

        return [
            'message' => 'Marked as read',
            'notification' => $n,
            'unread_count' => $this->unreadCount($userId),
        ];
    }

    public function markAllAsRead(int $userId)
    {
        $this->baseQuery($userId)->whereNull('read_at')->update(['read_at' => now()]);
        return [
            'message' => 'All notifications marked as read',
            'unread_count' => 0,
        ];
    }

    public function delete(string $id, int $userId)
    {
        $n = $this->baseQuery($userId)->where('id', $id)->first();
        if (!$n) return ['status' => 404, 'error' => 'Notification not found'];

        $n->delete();
        return [
            'message' => 'Deleted',
            'unread_count' => $this->unreadCount($userId),
        ];
    }

    public function deleteAll(int $userId)
    {
        $this->baseQuery($userId)->delete();
        return [
            'message' => 'All notifications deleted',
            'unread_count' => 0,
        ];
    }

    // ----------------------------
    // Send helpers
    // ----------------------------
    public function notifyUser(User $user, string $type, string $title, ?string $body = null, array $data = []): void
    {
        // لازم يكون User يستخدم Notifiable
        $user->notify(new SystemNotification(
            type: $type,
            title: $title,
            body: $body,
            data: $data
        ));
    }

    /**
     * ✅ يرسل إشعار لكل "مشاركي المشروع" باستخدام Project object
     */
    public function notifyProject(
        Project $project,
        string $type,
        string $title,
        ?string $body = null,
        array $data = [],
        ?int $ignoreUserId = null
    ): void
    {
        $this->notifyProjectParticipants(
            projectId: $project->id,
            actorUserId: $ignoreUserId ?? 0,
            type: $type,
            title: $title,
            body: $body,
            data: $data
        );
    }

    /**
     * ✅ يرسل إشعار لكل "مشاركي المشروع" (مالك + مشرف + أعضاء من project_members)
     * مع استثناء الشخص الذي نفذ الحدث (actorUserId)
     */
    public function notifyProjectParticipants(
        int $projectId,
        int $actorUserId,
        string $type,
        string $title,
        ?string $body = null,
        array $data = []
    ): void
    {
        // 1) owner + supervisor
        $projectRow = DB::table('projects')
            ->select('user_id', 'supervisor_id')
            ->where('id', $projectId)
            ->first();

        if (!$projectRow) return;

        $ids = [];

        if (!empty($projectRow->user_id)) $ids[] = (int)$projectRow->user_id;
        if (!empty($projectRow->supervisor_id)) $ids[] = (int)$projectRow->supervisor_id;

        // 2) members (project_members.student_id)
        $memberIds = DB::table('project_members')
            ->where('project_id', $projectId)
            ->pluck('student_id')
            ->map(fn ($x) => (int)$x)
            ->toArray();

        $ids = array_values(array_unique(array_merge($ids, $memberIds)));

        // 3) exclude actor
        $ids = array_values(array_filter($ids, fn ($id) => $id !== (int)$actorUserId));

        if (count($ids) === 0) return;

        $users = User::whereIn('id', $ids)->get();
        foreach ($users as $u) {
            $this->notifyUser($u, $type, $title, $body, $data);
        }
    }
    
}
