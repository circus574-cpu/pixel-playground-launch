<?php
// Uses Coolify's existing GitHub App, without exporting or printing credentials.
require '/var/www/html/vendor/autoload.php';
$app = require '/var/www/html/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
$targets = ['cbp8moqj7nyjag4szbmvgczv','bhlcaqj8kuqmjqktnfrw1f0y','bzo0ptfidwvbsi0lmyoe7xgo','izzgbsiybh632beq9nvq1ktp'];
$busy = App\Models\ApplicationDeploymentQueue::whereIn('status',['queued','in_progress'])->exists();
foreach ($targets as $uuid) {
  $a = App\Models\Application::where('uuid',$uuid)->firstOrFail();
  if (!preg_match('~^circus574-cpu/[a-zA-Z0-9_.-]+$~',$a->git_repository)) throw new Exception('Unexpected repository');
  $token = $a->source->installationToken();
  $response = Illuminate\Support\Facades\Http::timeout(20)->withToken($token)->get('https://api.github.com/repos/'.$a->git_repository.'/commits/'.rawurlencode($a->git_branch));
  if (!$response->successful()) throw new Exception('GitHub read failed: '.$response->status());
  $sha = $response->json('sha');
  if (!preg_match('/^[0-9a-f]{40}$/',$sha)) throw new Exception('Invalid source SHA');
  $known = App\Models\ApplicationDeploymentQueue::where('application_id',$a->id)->where('commit',$sha)->latest('id')->first();
  echo $a->name.' | '.$a->git_repository.' | '.$a->git_branch.' | '.$sha.' | '.($known?->status ?? 'new').PHP_EOL;
  if (getenv('KI_DEPLOY_APPLY') === '1' && !$known && !$busy) {
    queue_application_deployment(application:$a,deployment_uuid:(string)Illuminate\Support\Str::uuid(),commit:$sha,is_api:true);
    $busy = true; // Only one new build per polling pass; preserve the running version on failure.
    echo 'QUEUED '.$a->name.PHP_EOL;
  }
}
