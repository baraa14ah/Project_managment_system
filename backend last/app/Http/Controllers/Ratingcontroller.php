<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Models\Rating;
use App\Services\RatingService;
use Illuminate\Http\Request;

class Ratingcontroller extends Controller
{
   protected $service;

    public function __construct(RatingService $service)
    {
        $this->service = $service;
    }

    public function rateProject(Request $request, $projectId)
    {
        $request->validate([
            'rating' => 'required|integer|min:1|max:5'
        ]);

        $result = $this->service->rateProject($request, $projectId);

        if ($result === 'already_rated') {
            return response()->json([
                'message' => 'You already rated this project'
            ], 409);
        }

        return response()->json([
            'message' => 'Project rated successfully',
            'rating'  => $result
        ]);
    }

    public function projectRatings($projectId)
    {
        return response()->json([
            'ratings' => Rating::with('user')
                ->where('project_id', $projectId)
                ->get()
        ]);
    }

    public function deleteRating(Request $request, $projectId)
    {
        $rating = Rating::where('project_id', $projectId)
            ->where('user_id', $request->user()->id)
            ->first();

        if (!$rating) {
            return response()->json(['message' => 'Rating not found'], 404);
        }

        $this->service->delete($rating);

        return response()->json(['message' => 'Rating deleted']);
    }
}
