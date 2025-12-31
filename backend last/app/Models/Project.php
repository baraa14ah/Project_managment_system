<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use App\Models\GitCommit;



class Project extends Model
{
    use HasFactory;

    protected $fillable = [
        'title',
        'description',
        'github_repo_url',
        'user_id',
        'status',
        'supervisor_id',
    ];
    
    

    public function user()
    {
        return $this->belongsTo(User::class);
    }


    
    public function tasks()
{
    return $this->hasMany(Task::class);
}


public function supervisor()
{
    return $this->belongsTo(User::class, 'supervisor_id');
    
}  


public function commits()
{
    return $this->hasMany(GitCommit::class);
}


public function versions()
{
    return $this->hasMany(ProjectVersion::class);
}

public function students()
{
    return $this->belongsToMany(User::class, 'project_user');
}



// أعضاء المشروع (طلاب) عبر جدول project_members
public function members()
{
    return $this->belongsToMany(\App\Models\User::class, 'project_members', 'project_id', 'student_id')
        ->withTimestamps();
}



 

}
