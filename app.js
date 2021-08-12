const express = require("express");
const path = require("path");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const app = express();
app.use(express.json());

const dbPath = path.join(__dirname, "covid19IndiaPortal.db");

let db = null;

const startDbAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("server started at 3000");
    });
  } catch (error) {
    console.log(`DB Error:${error.message}`);
    process.exit(1);
  }
};
startDbAndServer();

//login
app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const verifyUserQuery = `SELECT * FROM user WHERE username='${username}';`;
  const dbUser = await db.get(verifyUserQuery);

  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const verifyPassword = await bcrypt.compare(password, dbUser.password);
    if (verifyPassword === true) {
      const payload = { username: username };
      const jwtToken = jwt.sign(payload, "my secret key");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

//authentication token verify
function authentication(request, response, next) {
  const authenticationHeader = request.headers["authorization"];
  let jwtToken;
  if (authenticationHeader !== undefined) {
    jwtToken = authenticationHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "my secret key", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        next();
      }
    });
  }
}

//get all states
app.get("/states/", authentication, async (request, response) => {
  const getStatesQuery = `SELECT 
  state_id AS stateId,state_name AS stateName,population
  FROM state ;`;
  const states = await db.all(getStatesQuery);
  response.send(states);
});

//get a state
app.get("/states/:stateId/", authentication, async (request, response) => {
  const { stateId } = request.params;
  const getAStateQuery = `SELECT 
  state_id AS stateId,state_name AS stateName,population FROM state WHERE state_id=${stateId};`;
  const state = await db.get(getAStateQuery);
  response.send(state);
});

//post district
app.post("/districts/", authentication, async (request, response) => {
  const { districtName, stateId, cases, cured, active, deaths } = request.body;
  const createDistrictQuery = `INSERT INTO district (district_name,state_id,cases,cured,active,deaths)
    VALUES ('${districtName}',${stateId},${cases},${cured},${active},${deaths});`;
  await db.run(createDistrictQuery);
  response.send("District Successfully Added");
});

//get a district
app.get(
  "/districts/:districtId/",
  authentication,
  async (request, response) => {
    const { districtId } = request.params;
    const getADistrictQuery = `SELECT 
    district_id AS districtId,district_name AS districtName,state_id As stateId,cases,cured,active,deaths
    FROM district WHERE district_id=${districtId};`;
    const district = await db.get(getADistrictQuery);
    response.send(district);
  }
);

//delete a district
app.delete(
  "/districts/:districtId/",
  authentication,
  async (request, response) => {
    const { districtId } = request.params;
    const deleteADistrictQuery = `DELETE FROM district WHERE district_id=${districtId};`;
    await db.run(deleteADistrictQuery);
    response.send("District Removed");
  }
);

//put district
app.put(
  "/districts/:districtId/",
  authentication,
  async (request, response) => {
    const { districtId } = request.params;
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = request.body;
    const updateDistrictQuery = `UPDATE district
  SET district_name='${districtName}',state_id=${stateId},
  cases=${cases},cured=${cured},active=${active},deaths=${deaths}
    where district_id=${districtId};`;
    await db.run(updateDistrictQuery);
    response.send("District Details Updated");
  }
);
//statistics of a state
app.get(
  "/states/:stateId/stats/",
  authentication,
  async (request, response) => {
    const { stateId } = request.params;
    const getStatsQuery = `SELECT sum(cases) as totalCases,sum(cured) as totalCured,
    sum(active) as totalActive,sum(deaths) as totalDeaths FROM district where  state_id=${stateId};`;
    const stats = await db.get(getStatsQuery);
    response.send(stats);
  }
);
module.exports = app;
