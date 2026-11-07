<?php
namespace app\service;

/** Minimal POP3 client retained for the legacy MailApi endpoints (110/995). */
class Pop3SocketClient
{
    /** @var resource|null */
    private $socket;
    private bool $closed = false;
    private int $timeout;

    private function __construct($socket, int $timeout)
    {
        $this->socket = $socket;
        $this->timeout = $timeout;
    }

    public static function connect(string $host, int $port, string $username, string $password, int $timeout = 15): self
    {
        $host = trim($host);
        $timeout = max(5, min(60, $timeout));
        if ($host === '' || preg_match('/[\s\/{}\r\n\x00]/', $host) || !in_array($port, [110, 995], true)) {
            throw new \RuntimeException('POP3 服务器地址或端口无效');
        }
        $context = stream_context_create(['ssl' => [
            'verify_peer' => false,
            'verify_peer_name' => false,
            'allow_self_signed' => true,
        ]]);
        $target = ($port === 995 ? 'ssl://' : 'tcp://') . $host . ':' . $port;
        $errno = 0;
        $errstr = '';
        $socket = @stream_socket_client($target, $errno, $errstr, $timeout, STREAM_CLIENT_CONNECT, $context);
        if (!is_resource($socket)) throw new \RuntimeException('无法连接 POP3 服务器：' . self::safe($errstr ?: (string) $errno));
        stream_set_timeout($socket, $timeout);
        $client = new self($socket, $timeout);
        try {
            $client->expectOk();
            $client->command('USER ' . self::argument($username));
            $client->command('PASS ' . self::argument($password));
            return $client;
        } catch (\Throwable $e) {
            $client->close(false);
            throw $e;
        }
    }

    private static function argument(string $value): string
    {
        if ($value === '' || preg_match('/[\x00\r\n]/', $value)) throw new \InvalidArgumentException('POP3 参数无效');
        return $value;
    }

    private static function safe(string $value): string
    {
        return substr(trim(preg_replace('/[\r\n\x00-\x1F]+/', ' ', $value)), 0, 180);
    }

    private function writeLine(string $line): void
    {
        $data = $line . "\r\n";
        $offset = 0;
        while ($offset < strlen($data)) {
            $written = @fwrite($this->socket, substr($data, $offset));
            if ($written === false || $written === 0) throw new \RuntimeException('POP3 命令发送失败');
            $offset += $written;
        }
    }

    private function readLine(): string
    {
        $line = @fgets($this->socket, 8192);
        if ($line === false) {
            $meta = stream_get_meta_data($this->socket);
            throw new \RuntimeException(!empty($meta['timed_out']) ? 'POP3 服务器响应超时' : 'POP3 连接中断');
        }
        return $line;
    }

    private function expectOk(): string
    {
        $line = $this->readLine();
        if (stripos($line, '+OK') !== 0) throw new \RuntimeException('POP3 操作失败：' . self::safe($line));
        return trim($line);
    }

    private function command(string $command): string
    {
        if (preg_match('/[\x00\r\n]/', $command)) throw new \InvalidArgumentException('POP3 命令无效');
        $this->writeLine($command);
        return $this->expectOk();
    }

    public function count(): int
    {
        $response = $this->command('STAT');
        if (!preg_match('/\+OK\s+(\d+)/i', $response, $match)) return 0;
        return (int) $match[1];
    }

    public function retrieve(int $number): string
    {
        if ($number < 1) throw new \InvalidArgumentException('无效的邮件编号');
        $this->writeLine('RETR ' . $number);
        $this->expectOk();
        $data = '';
        while (true) {
            $line = $this->readLine();
            if ($line === ".\r\n" || $line === ".\n") break;
            if (str_starts_with($line, '..')) $line = substr($line, 1);
            $data .= $line;
            if (strlen($data) > 67108864) throw new \RuntimeException('邮件内容超过 64 MiB 限制');
        }
        return $data;
    }

    public function delete(int $number): void
    {
        if ($number < 1) throw new \InvalidArgumentException('无效的邮件编号');
        $this->command('DELE ' . $number);
    }

    public function close(bool $sendQuit = true): void
    {
        if ($this->closed) return;
        if ($sendQuit && is_resource($this->socket)) {
            try { $this->writeLine('QUIT'); $this->expectOk(); } catch (\Throwable $ignored) {}
        }
        if (is_resource($this->socket)) @fclose($this->socket);
        $this->socket = null;
        $this->closed = true;
    }

    public function __destruct()
    {
        $this->close(false);
    }
}
