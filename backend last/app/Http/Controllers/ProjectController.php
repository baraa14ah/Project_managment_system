<?php

namespace App\Http\Controllers;

use App\Models\Project;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use App\Models\GitCommit;


class ProjectController extends Controller
{
    /**
     * ✅ ترجع اسم الدور بشكل موحّد (سواء كان role relation أو نص)
     */
    private function roleName($user): string
    {
        return $user->role?->name ?? (string)($user->role ?? '');
    }

    /**
     * ✅ صلاحية الوصول للمشروع:
     * admin أو مالك المشروع أو المشرف أو عضو ضمن project_members
     */
    private function canAccessProject($user, $project): bool
    {
        if (!$user || !$project) return false;

        $role = $this->roleName($user);

        if ($role === 'admin') return true;
        if ((int)$project->user_id === (int)$user->id) return true;
        if ((int)$project->supervisor_id === (int)$user->id) return true;

        // عضو بالمشروع (بعد قبول الدعوة) — بدون status لأن جدولك غالباً ما يحتويه
        return DB::table('project_members')
            ->where('project_id', $project->id)
            ->where('student_id', $user->id)
            ->exists();
    }

    /**
     * ✅ صلاحية تعديل المشروع:
     * admin أو مالك المشروع أو المشرف
     */
    private function canEditProject($user, $project): bool
    {
        if (!$user || !$project) return false;

        $role = $this->roleName($user);

        return $role === 'admin'
            || (int)$project->user_id === (int)$user->id
            || (int)$project->supervisor_id === (int)$user->id;
    }

    /**
     * ✅ صلاحية حذف المشروع:
     * admin أو مالك المشروع فقط
     */
    private function canDeleteProject($user, $project): bool
    {
        if (!$user || !$project) return false;

        $role = $this->roleName($user);

        return $role === 'admin'
            || (int)$project->user_id === (int)$user->id;
    }

    /**
     * ✅ إنشاء مشروع جديد (Student/Admin حسب Middleware في routes)
     */
    public function create(Request $request)
    {
        // إذا تريد Validation هنا بدل ProjectService:
        $request->validate([
            'title' => 'required|string|max:255',
            'description' => 'required|string',
        ]);

        $user = $request->user();

        $project = Project::create([
            'title' => $request->title,
            'description' => $request->description,
            'user_id' => $user->id,
            'status' => 'pending',
        ]);

        $project->load(['user', 'supervisor']);

        return response()->json([
            'message' => 'Project created successfully',
            'project' => $project,
        ], 201);
    }

    /**
     * ✅ عرض المشاريع حسب الدور:
     * - admin: كل المشاريع
     * - supervisor: المشاريع التي يشرف عليها
     * - student: مشاريعه كمالك + المشاريع التي هو عضو بها (project_members)
     */
    public function index(Request $request)
    {
        $user = $request->user();
        if (!$user) return response()->json(['message' => 'Unauthenticated'], 401);

        $role = $this->roleName($user);

        if ($role === 'admin') {
            $projects = Project::with(['user', 'supervisor'])->get();
        } elseif ($role === 'supervisor') {
            $projects = Project::where('supervisor_id', $user->id)
                ->with(['user', 'supervisor'])
                ->get();
        } else {
            // الطالب: مالك + عضو
            $projects = Project::where(function ($q) use ($user) {
                    $q->where('user_id', $user->id)
                      ->orWhereIn('id', function ($sub) use ($user) {
                          $sub->select('project_id')
                              ->from('project_members')
                              ->where('student_id', $user->id);
                      });
                })
                ->with(['user', 'supervisor'])
                ->get();
        }

        return response()->json(['projects' => $projects]);
    }

    /**
     * ✅ عرض مشروع واحد (مع التحقق من صلاحية الوصول)
     */
    public function show(Request $request, $id)
    {
        $project = Project::with([
            'user:id,name,email',
            'supervisor:id,name,email',
            'members:id,name,email'
        ])->find($id);
        

        if (!$project) {
            return response()->json(['message' => 'Project not found'], 404);
        }

        if (!$this->canAccessProject($request->user(), $project)) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        return response()->json(['project' => $project]);
    }

    /**
     * ✅ تعديل مشروع (المالك + المشرف + admin)
     * يسمح بتعديل: title + description
     */
    public function update(Request $request, $id)
    {
        $project = Project::find($id);
        if (!$project) return response()->json(['message' => 'Project not found'], 404);
    
        if (!$this->canEditProject($request->user(), $project)) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }
    
        $request->validate([
            'title' => 'required|string|max:255',
            'description' => 'required|string',
            'github_repo_url' => 'nullable|url|max:255',
          ]);
          
          $project->title = $request->title;
          $project->description = $request->description;
          $project->github_repo_url = $request->github_repo_url; // ✅
          $project->save();
          
    
        $project->load(['user', 'supervisor']);
    
        return response()->json([
            'message' => 'Project updated successfully',
            'project' => $project,
        ]);
    }
    

    /**
     * ✅ حذف مشروع (المالك فقط + admin)
     */
    public function delete(Request $request, $id)
    {
        $project = Project::find($id);
        if (!$project) return response()->json(['message' => 'Project not found'], 404);

        if (!$this->canDeleteProject($request->user(), $project)) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $project->delete();

        return response()->json([
            'message' => 'Project deleted successfully',
        ]);
    }

    /**
     * ✅ إلغاء الإشراف (المشرف الحالي أو admin)
     */
    public function leaveSupervision(Request $request, $projectId)
    {
        $user = $request->user();

        $project = Project::find($projectId);
        if (!$project) return response()->json(['message' => 'Project not found'], 404);

        $isAdmin = $this->roleName($user) === 'admin';
        $isCurrentSupervisor = (int)$project->supervisor_id === (int)$user->id;

        if (!$isCurrentSupervisor && !$isAdmin) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $project->supervisor_id = null;
        $project->save();

        $project->load(['user', 'supervisor']);

        return response()->json([
            'message' => 'Supervision removed successfully',
            'project' => $project
        ]);
    }

    /**
     * ✅ نسبة التقدم للمشروع (يعتمد على ProjectService/منطقك السابق)
     * (إذا عندك Service للحساب، خليه كما كان)
     */
    public function progress($id)
    {
        // إذا عندك منطق سابق في Service، استبدله هنا كما تريد.
        // حالياً مثال بسيط: احسب من tasks (إذا عندك جدول tasks)
        $total = DB::table('tasks')->where('project_id', $id)->count();
        $completed = DB::table('tasks')->where('project_id', $id)->where('status', 'completed')->count();
        $percent = $total ? round(($completed / $total) * 100) : 0;

        return response()->json([
            'total_tasks' => $total,
            'completed_tasks' => $completed,
            'progress_percentage' => $percent,
        ]);
    }


    public function commits($id)
    {
        $project = Project::find($id);
        if (!$project) {
            return response()->json(['message' => 'Project not found'], 404);
        }
    
        if (!$this->canAccessProject(request()->user(), $project)) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }
    
        $commits = GitCommit::where('project_id', $project->id)
            ->orderBy('committed_at', 'desc')
            ->get();
    
        return response()->json([
            'commits' => $commits
        ]);
    }
    

public function syncCommits(Request $request, $id)
{
    try{
    $project = Project::with('user')->find($id);
    if (!$project) return response()->json(['message' => 'Project not found'], 404);

    // صلاحيات (اختياري) – خليه مثل عندك
    if (!$this->canEditProject($request->user(), $project)) {
        return response()->json(['message' => 'Unauthorized'], 403);
    }

    if (!$project->github_repo_url) {
        return response()->json(['message' => 'GitHub repo url is missing'], 422);
    }

    // ✅ استخراج owner/repo من أي رابط GitHub
    $url = trim($project->github_repo_url);
    $url = preg_replace('/\.git$/', '', $url); // remove .git if exists

    if (!preg_match('~github\.com/([^/]+)/([^/]+)~i', $url, $m)) {
        return response()->json([
            'message' => 'Invalid GitHub repo url',
            'url' => $project->github_repo_url
        ], 422);
    }

    $owner = $m[1];
    $repo  = $m[2];

    $token = env('GITHUB_TOKEN'); // ضع التوكن في .env
    if (!$token) {
        return response()->json([
            'message' => 'GITHUB_TOKEN is missing in .env'
        ], 500);
    }

    $apiUrl = "https://api.github.com/repos/{$owner}/{$repo}/commits?per_page=30";

    $res = Http::withHeaders([
        'Accept' => 'application/vnd.github+json',
        'Authorization' => "Bearer {$token}",
        'X-GitHub-Api-Version' => '2022-11-28',
        'User-Agent' => 'ByteHub-App'
    ])->get($apiUrl);

    if (!$res->successful()) {
        // ✅ رجع السبب الحقيقي بدل رسالة عامة
        return response()->json([
            'message' => 'Failed to fetch commits from GitHub',
            'status' => $res->status(),
            'github_response' => $res->json(),
            'api_url' => $apiUrl,
        ], 500);
    }

    $items = $res->json() ?? [];
    $saved = 0;

    foreach ($items as $item) {
        $sha = $item['sha'] ?? null;
        if (!$sha) continue;
        $commit = GitCommit::updateOrCreate(
            [
                'project_id'  => $project->id,
                'commit_hash' => $sha,
            ],
            [
                'author_name'  => $item['commit']['author']['name'] ?? null,
                'message'      => $item['commit']['message'] ?? null,
                'committed_at' => $item['commit']['author']['date'] ?? null,
                'url'          => $item['html_url'] ?? null,
            ]
        );
        
        

        $saved++;
    }

    return response()->json([
        'message' => 'Commits synced successfully',
        'count' => $saved,
    ]);

} catch (\Throwable $e) {
    return response()->json([
        'message' => 'Server error while syncing commits',
        'error' => $e->getMessage(),
        'file' => $e->getFile(),  
        'line' => $e->getLine(),
    ], 500);


}


}
}
