<?php

namespace App\Services;

use App\Models\GitCommit;
use App\Models\Project;
use Illuminate\Support\Facades\Http;

class GitHubService
{
    protected function parseRepoPath(string $url): ?array
    {
        // مثال URL: https://github.com/user/repo
        $parts = parse_url($url);

        if (!isset($parts['path'])) {
            return null;
        }

        $segments = explode('/', trim($parts['path'], '/')); // ['user', 'repo']

        if (count($segments) < 2) {
            return null;
        }

        return [
            'owner' => $segments[0],
            'repo'  => $segments[1],
        ];
    }

    public function syncProjectCommits(Project $project): array
    {
        if (!$project->github_repo_url) {
            return ['error' => 'Project has no GitHub repo URL'];
        }

        $repoInfo = $this->parseRepoPath($project->github_repo_url);

        if (!$repoInfo) {
            return ['error' => 'Invalid GitHub repo URL'];
        }

        $token = env('GITHUB_TOKEN');

        if (!$token) {
            return ['error' => 'GitHub token is not configured'];
        }

        $url = "https://api.github.com/repos/{$repoInfo['owner']}/{$repoInfo['repo']}/commits";

        $response = Http::withToken($token)->get($url);

        if ($response->failed()) {
            return ['error' => 'Failed to fetch commits from GitHub', 'status' => $response->status()];
        }

        $commitsData = $response->json();

        foreach ($commitsData as $commitItem) {
            $sha   = $commitItem['sha'] ?? null;
            $commit = $commitItem['commit'] ?? [];
            $author = $commit['author'] ?? [];
            $htmlUrl = $commitItem['html_url'] ?? null;

            if (!$sha) {
                continue;
            }

            GitCommit::updateOrCreate(
                [
                    'project_id'  => $project->id,
                    'commit_hash' => $sha,
                ],
                [
                    'author_name'  => $author['name'] ?? null,
                    'author_email' => $author['email'] ?? null,
                    'message'      => $commit['message'] ?? null,
                    'committed_at' => $author['date'] ?? null,
                    'url'          => $htmlUrl,
                ]
            );
        }

        return ['success' => true];
    }
}
