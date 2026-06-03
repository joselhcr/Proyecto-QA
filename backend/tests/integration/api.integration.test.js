process.env.JWT_SECRET = process.env.JWT_SECRET || "integration-test-secret";
process.env.NODE_ENV = "test";

const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const request = require("supertest");
const { MongoMemoryServer } = require("mongodb-memory-server");

const { createApp } = require("../../app");
const User = require("../../models/User");
const Token = require("../../models/Token");
const Match = require("../../models/Match");
const LeaderboardEntry = require("../../models/LeaderboardEntry");

jest.setTimeout(120000);

let mongo;
let app;

const credentialsFor = (suffix) => ({
  username: `player_${suffix}`,
  email: `player_${suffix}@correo.com`,
  password: `Password-${suffix}`,
});

const register = async (user) =>
  request(app).post("/auth/register").send(user).expect(201);

const login = async ({ email, password }) => {
  const response = await request(app)
    .post("/auth/login")
    .send({ email, password })
    .expect(200);

  return response.body.token;
};

const authHeader = (token) => ({ Authorization: `Bearer ${token}` });

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  app = createApp();
});

afterEach(async () => {
  await Promise.all(
    Object.values(mongoose.connection.collections).map((collection) =>
      collection.deleteMany({}),
    ),
  );
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

describe("Pruebas de integracion API + MongoDB", () => {
  test("TC-I-01 registra usuario y persiste sus datos en MongoDB", async () => {
    const user = credentialsFor("register");

    const response = await request(app)
      .post("/auth/register")
      .send(user)
      .expect(201);

    expect(response.body).toEqual({
      message: "User registered successfully",
    });

    const savedUser = await User.findOne({ email: user.email });
    expect(savedUser).toBeTruthy();
    expect(savedUser.username).toBe(user.username);
    expect(savedUser.password).toBe(user.password);
  });

  test("TC-I-02 login valida contra MongoDB, crea token y emite JWT verificable", async () => {
    const user = credentialsFor("login");
    await register(user);

    const response = await request(app)
      .post("/auth/login")
      .send({ email: user.email, password: user.password })
      .expect(200);

    const decoded = jwt.verify(response.body.token, process.env.JWT_SECRET);
    expect(decoded.userId).toBeTruthy();
    expect(response.body.username).toBe(user.username);

    const tokenDoc = await Token.findOne({ username: user.username });
    expect(tokenDoc).toBeTruthy();
    expect(tokenDoc.token).toBe(response.body.token);
    expect(tokenDoc.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  test("TC-I-03 matchmaking crea espera y luego empareja un segundo jugador", async () => {
    const playerOne = credentialsFor("match_a");
    const playerTwo = credentialsFor("match_b");
    await register(playerOne);
    await register(playerTwo);
    const tokenOne = await login(playerOne);
    const tokenTwo = await login(playerTwo);

    await request(app)
      .post("/leaderboard/matchmaking")
      .set(authHeader(tokenOne))
      .send({ player: playerOne.username })
      .expect(202)
      .expect((res) => {
        expect(res.body.message).toMatch(/Searching/);
      });

    const waitingStatus = await request(app)
      .get("/leaderboard/matchmaking/status")
      .set(authHeader(tokenOne))
      .query({ player: playerOne.username })
      .expect(200);
    expect(waitingStatus.body.message).toMatch(/searching/i);

    const matchResponse = await request(app)
      .post("/leaderboard/matchmaking")
      .set(authHeader(tokenTwo))
      .send({ player: playerTwo.username })
      .expect(200);

    expect(matchResponse.body.matchId).toBeTruthy();
    expect(matchResponse.body.opponent).toBe(playerOne.username);

    const match = await Match.findById(matchResponse.body.matchId);
    expect(match.status).toBe("active");
    expect(match.player).toBe(playerOne.username);
    expect(match.opponent).toBe(playerTwo.username);
  });

  test("TC-I-04 realtime move actualiza tablero, eventos y estado persistido", async () => {
    const playerOne = credentialsFor("move_a");
    const playerTwo = credentialsFor("move_b");
    await Promise.all([register(playerOne), register(playerTwo)]);
    const token = await login(playerOne);
    const match = await Match.create({
      player: playerOne.username,
      opponent: playerTwo.username,
      status: "active",
      lastMoveTime: new Date(),
    });

    const response = await request(app)
      .post("/realtime/move")
      .set(authHeader(token))
      .send({ matchId: match._id.toString(), player: playerOne.username, index: 4 })
      .expect(200);

    expect(response.body.state.board[4]).toBe("X");
    expect(response.body.state.moves).toHaveLength(1);
    expect(response.body.state.events[0].type).toBe("move");

    const persisted = await Match.findById(match._id);
    expect(persisted.moves[0].move).toEqual({ row: 1, column: 1 });
  });

  test("TC-I-05 y TC-I-13 finalizar partida PvP actualiza ELO, usuarios e historial", async () => {
    const playerOne = credentialsFor("finish_a");
    const playerTwo = credentialsFor("finish_b");
    await Promise.all([register(playerOne), register(playerTwo)]);
    const token = await login(playerOne);
    const match = await Match.create({
      player: playerOne.username,
      opponent: playerTwo.username,
      status: "active",
      lastMoveTime: new Date(),
    });

    const finishResponse = await request(app)
      .post("/leaderboard/match/finish")
      .set(authHeader(token))
      .send({ matchId: match._id.toString(), winner: playerOne.username })
      .expect(200);

    expect(finishResponse.body.match.status).toBe("complete");
    expect(finishResponse.body.match.winner).toBe(playerOne.username);

    const [winnerEntry, loserEntry, winnerUser, loserUser] = await Promise.all([
      LeaderboardEntry.findOne({ username: playerOne.username }),
      LeaderboardEntry.findOne({ username: playerTwo.username }),
      User.findOne({ username: playerOne.username }),
      User.findOne({ username: playerTwo.username }),
    ]);

    expect(winnerEntry.elo).toBeGreaterThan(1200);
    expect(loserEntry.elo).toBeLessThan(1200);
    expect(winnerUser.totalWins).toBe(1);
    expect(loserUser.totalLosses).toBe(1);

    const history = await request(app)
      .get("/leaderboard/match/history")
      .set(authHeader(token))
      .query({ username: playerOne.username })
      .expect(200);

    expect(history.body.matches).toHaveLength(1);
    expect(history.body.matches[0]._id).toBe(match._id.toString());
  });

  test("TC-I-07 rechaza acceso a perfil sin JWT", async () => {
    await request(app)
      .get("/profile")
      .expect(401)
      .expect((res) => {
        expect(res.body.error).toBe("Unauthorized");
      });
  });

  test("TC-I-08 rechaza registro duplicado sin crear otro usuario", async () => {
    const user = credentialsFor("duplicate");
    await register(user);

    await request(app).post("/auth/register").send(user).expect(400);

    const count = await User.countDocuments({ email: user.email });
    expect(count).toBe(1);
  });

  test("TC-I-09 partida contra IA actualiza leaderboard y estadisticas de usuario", async () => {
    const user = credentialsFor("ai");
    await register(user);
    const token = await login(user);

    const response = await request(app)
      .post("/leaderboard/ai-match")
      .set(authHeader(token))
      .send({ player: user.username, result: "win", difficulty: "hard" })
      .expect(201);

    expect(response.body.updatedPlayer.elo).toBeGreaterThan(1200);

    const profile = await User.findOne({ username: user.username });
    expect(profile.gamesPlayed).toBe(1);
    expect(profile.totalWins).toBe(1);
  });

  test("TC-I-10 leaderboard retorna jugadores ordenados con paginacion", async () => {
    await LeaderboardEntry.create([
      { username: "low", elo: 1100 },
      { username: "high", elo: 1500 },
      { username: "mid", elo: 1300 },
    ]);

    const response = await request(app)
      .get("/leaderboard")
      .query({ page: 1, limit: 2 })
      .expect(200);

    expect(response.body.total).toBe(3);
    expect(response.body.page).toBe(1);
    expect(response.body.limit).toBe(2);
    expect(response.body.results.map((entry) => entry.username)).toEqual([
      "high",
      "mid",
    ]);
  });

  test("TC-I-11 login con password incorrecto rechaza y no emite JWT", async () => {
    const user = credentialsFor("bad_password");
    await register(user);

    const response = await request(app)
      .post("/auth/login")
      .send({ email: user.email, password: "wrong-password" })
      .expect(401);

    expect(response.body.error).toBe("Invalid email or password");
    expect(response.body.token).toBeUndefined();
  });

  test("TC-I-12 validate-token rechaza JWT expirado registrado en MongoDB", async () => {
    const user = credentialsFor("expired");
    await register(user);
    const savedUser = await User.findOne({ username: user.username });
    const expiredToken = jwt.sign(
      { userId: savedUser._id },
      process.env.JWT_SECRET,
      { expiresIn: "-1h" },
    );
    await Token.create({
      username: user.username,
      token: expiredToken,
      createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
      expiresAt: new Date(Date.now() - 60 * 60 * 1000),
    });

    await request(app)
      .get("/auth/validate-token")
      .set(authHeader(expiredToken))
      .expect(401)
      .expect((res) => {
        expect(res.body.valid).toBe(false);
      });
  });
});
