<?php

namespace App\Services;

use App\Models\Project;
use App\Repositories\ProjectRepository;
use Illuminate\Http\Request;

class ProjectService
{
    protected ProjectRepository $projects;

    public function __construct(ProjectRepository $projects)
    {
        $this->projects = $projects;
    }

    // إنشاء مشروع جديد (Admin فقط - الشرط يكون في الميدل وير role:admin)
    public function create(Request $request): Project
    {
        $data = $request->validate([
            'title'            => 'required|string|max:255',
            'description'      => 'nullable|string',
            'github_repo_url'  => 'nullable|url',
            'supervisor_id'    => 'nullable|exists:users,id',
        ]);

        $data['user_id'] = $request->user()->id;
        $data['status']  = 'pending';

        return $this->projects->create($data);
    }

    // جلب المشاريع حسب نوع المستخدم
    public function listForUser($user)
    {
        return $this->projects->getForUser($user);
    }

    // تعديل مشروع
    // return: Project | null | 'unauthorized'
    public function update(Request $request, int $id, $user)
    {
        $project = $this->projects->findById($id);

        if (!$project) {
            return null;
        }

        $data = $request->validate([
            'title'            => 'required|string|max:255',
            'description'      => 'nullable|string',
            'status'           => 'nullable|in:pending,in_progress,completed',
            'github_repo_url'  => 'nullable|url',
            'supervisor_id'    => 'nullable|exists:users,id',
        ]);

        $isAdmin = $user->role?->name === 'admin';

        // الطالب لا يمكنه تعديل مشروع غير مشروعه
        if (!$isAdmin && $project->user_id !== $user->id) {
            return 'unauthorized';
        }

        $data['status'] = $data['status'] ?? $project->status;

        return $this->projects->update($project, $data);
    }

    // حذف مشروع
    // return: true | null | 'unauthorized'
    public function delete(int $id, $user)
    {
        $project = $this->projects->findById($id);

        if (!$project) {
            return null;
        }

        $isAdmin = $user->role?->name === 'admin';

        if (!$isAdmin && $project->user_id !== $user->id) {
            return 'unauthorized';
        }

        $this->projects->delete($project);

        return true;
    }

    // حساب التقدم في المشروع
    // return: array | null
    public function progress(int $id): ?array
    {
        $project = Project::with('tasks')->find($id);

        if (!$project) {
            return null;
        }

        $totalTasks      = $project->tasks->count();
        $pendingTasks    = $project->tasks->where('status', 'pending')->count();
        $inProgressTasks = $project->tasks->where('status', 'in_progress')->count();
        $completedTasks  = $project->tasks->where('status', 'completed')->count();

        $progress = $totalTasks > 0
            ? round(($completedTasks / $totalTasks) * 100, 2)
            : 0;

        return [
            'project_id'          => $project->id,
            'total_tasks'         => $totalTasks,
            'pending_tasks'       => $pendingTasks,
            'in_progress_tasks'   => $inProgressTasks,
            'completed_tasks'     => $completedTasks,
            'progress_percentage' => $progress,
        ];
    }
}


